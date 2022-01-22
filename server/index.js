const { Pool, Client } = require("pg");

const moment = require("moment");

express = require("express");
const app = express();
const PORT = 3000;
// const PASSWORD = require('../config.js').password;

// const pool = new Pool({
//   user: "postgres",
//   host: "54.164.38.39",
//   database: "reviews",
//   password: "password",
// });

// const client = new Client({
//   user: "postgres",
//   host: "54.164.38.39",
//   database: "reviews",
//   password: "password",
// });

const pool = new Pool({
  user: "kyelindholm",
  host: "localhost",
  database: "reviews",
});

const client = new Client({
  user: "kyelindholm",
  host: "localhost",
  database: "reviews",
});

let cache = {};

client.connect();

app.get("/loaderio-f63b78408ca9b0baf3bed114eec14796.txt", (req, res) => {
  res.send("loaderio-f63b78408ca9b0baf3bed114eec14796");
});

app.get("/reviews/", (req, res) => {
  if (Object.keys(cache).length >= 100) cache = {};

  let page = Number(req.query.page) || 1;
  let count = Number(req.query.count) || 5;

  let returnObj = {
    product: req.query.product_id,
    page: page,
    count: count,
    results: [],
  };

  let reviewQuery = `SELECT id, rating, summary, recommend, response, body, date, reviewer_name, reviewer_email, helpfulness FROM reviews WHERE product_id = ${req.query.product_id} LIMIT ${count}`;

  if (cache['reviews/' + req.query.product_id]) {
    returnObj.results = cache['reviews/' + req.query.product_id];
    res.status(200).send(returnObj);
  } else {
    client
      .query(reviewQuery)
      .then((data) => {
        for (let review of data.rows) {
          if (!review.reported) {
            review["review_id"] = review["id"];
            returnObj["results"].push(review);
          }
        }

        let idArray = [];

        for (let review of returnObj["results"]) {
          review.photos = [];
          idArray.push(review.id);
        }

        let idString = JSON.stringify(idArray)
          .replace("[", "(")
          .replace("]", ")");

        client
          .query(`SELECT * FROM reviews_photos WHERE review_id IN ${idString}`)
          .then((data) => {
            if (data.rows.length > 0) {
              for (let photoData of data.rows) {
                for (let review of returnObj.results) {
                  if (review.id === photoData.review_id) {
                    review.photos.push({
                      id: photoData.id,
                      url: photoData.url,
                    });
                  }
                }
              }
            }

            if (req.query.sort === "newest")
              returnObj.results = returnObj.results.sort(
                (a, b) => b.date - a.date
              );
            else if (req.query.sort === "helpful")
              returnObj.results = returnObj.results.sort(
                (a, b) => b.helpfulness - a.helpfulness
              );
            else {
              returnObj.results = returnObj.results.sort((a, b) => {
                if (a.helpfulness === b.helpfulness) return b.date - a.date;
                return b.helpfulness - a.helpfulness;
              });
            }

            res.status(200).send(returnObj);
            cache['reviews/' + req.query.product_id] = returnObj.results;
          })
          .catch((err) => {
            throw err;
          });
      })
      .catch((err) => {
        throw err;
      });
  }
});

app.get("/reviews/meta", (req, res) => {
  if (Object.keys(cache).length >= 100) cache = {};

  let product_id = req.query.product_id;
  let responseObj = {
    product_id: product_id,
    ratings: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
    recommended: {
      0: 0,
      1: 0,
    },
    characteristics: {},
  };

  if (cache["meta/" + product_id]) {
    res.status(200).send(cache["meta/" + product_id]);
  } else {
    const ratingRecommend = client.query(
      `SELECT rating, recommend FROM reviews WHERE product_id=${Number(
        product_id
      )}`
    );
    const characteristicNames = client.query(
      `SELECT id, product_id, name FROM characteristics WHERE product_id=${Number(
        product_id
      )}`
    );

    Promise.all([ratingRecommend, characteristicNames]).then((data) => {
      let meta = data[0].rows;

      for (let entry of meta) {
        responseObj["ratings"][entry["rating"]] += 1;

        if (entry["recommend"]) {
          responseObj["recommended"][1] += 1;
        } else {
          responseObj["recommended"][0] += 1;
        }
      }

      let chars = data[1].rows;
      let ids = [];
      for (let characteristic of chars) {
        responseObj["characteristics"][characteristic.name] = {
          id: characteristic.id,
          value: "",
        };
        ids.push(characteristic.id);
      }

      let idString = JSON.stringify(ids).replace("[", "(").replace("]", ")");

      client
        .query(
          `SELECT value FROM characteristic_reviews WHERE id IN ${idString}`
        )
        .then((data) => {
          for (let char in responseObj["characteristics"]) {
            responseObj["characteristics"][char]["value"] = data.rows
              .shift()
              ["value"].toString();
          }

          res.status(200).send(responseObj);
          cache["meta/" + product_id] = responseObj;
        })
        .catch((err) => {
          throw err;
        });
    });
  }
});

app.post("/reviews", (req, res) => {
  let date = moment().format();
  let formattedDate = date.slice(0, date.indexOf("T"));

  let product_id = Number(req.query.product_id);
  let rating = Number(req.query.rating);

  let photos = JSON.parse(req.query.photos);
  let characteristics = JSON.parse(req.query.characteristics);

  client
    .query(
      `INSERT INTO reviews (product_id, rating, date, summary, body, recommend, reported, reviewer_name, reviewer_email, response, helpfulness) VALUES (${product_id}, ${rating}, ${formattedDate}, '${req.query.summary}', '${req.query.body}', ${req.query.recommend}, 'false', '${req.query.name}', '${req.query.email}', null, 0)`
    )
    .then((id) => {
      console.log("review table populated");
      res.status(201).send();

      client
        .query("SELECT MAX(id) FROM reviews")
        .then((max) => {
          let newId = max.rows[0].max;

          if (photos && photos.length > 0) {
            for (let i = 0; i < photos.length; i++) {
              let photo = photos[i];

              client
                .query(
                  `INSERT INTO reviews_photos (review_id, url) VALUES (${newId}, '${photo}')`
                )
                .then((x) => {
                  if (characteristics !== null) {
                    for (let key in characteristics) {
                      client
                        .query(
                          `INSERT INTO characteristic_reviews (characteristic_id, review_id, value) VALUES (${key}, ${newId}, ${characteristics[key]})`
                        )
                        .then((y) =>
                          console.log("characteristic_reviews populated")
                        )
                        .catch((err) => {
                          throw err;
                        });
                    }
                  }
                })
                .catch((err) => {
                  throw err;
                });
            }
          }
        })
        .catch((err) => {
          throw err;
        });
    })
    .catch((err) => {
      throw err;
    });
});

app.put("/reviews/:review_id/helpful", (req, res) => {
  const review_id = req.params.review_id;
  let helpfulness = 0;

  client
    .query(`SELECT helpfulness FROM reviews WHERE id = ${review_id}`)
    .then((response) => {
      let newHelpfulness = response.rows[0].helpfulness + 1;
      client
        .query(
          `UPDATE reviews SET helpfulness = ${newHelpfulness} WHERE id = ${review_id}`
        )
        .then((x) => {
          console.log(`review #${review_id} marked helpful`);
          res.status(204).send();
        })
        .catch((err) => {
          throw err;
        });
    })
    .catch((err) => {
      throw err;
    });
});

app.put("/reviews/:review_id/report", (req, res) => {
  const review_id = req.params.review_id;
  client
    .query(`UPDATE reviews SET reported = true WHERE id = ${review_id}`)
    .then((x) => {
      console.log(`review #${review_id} reported`);
      res.status(204).send();
    })
    .catch((err) => {
      throw err;
    });
});

app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
