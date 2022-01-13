const { Pool, Client } = require("pg");

const moment = require("moment");

express = require("express");
const app = express();
const PORT = 3000;

const pool = new Pool({
  user: "kyelindholm",
  host: "127.0.0.1",
  database: "reviews",
  password: null,
});

const client = new Client({
  user: "kyelindholm",
  host: "127.0.0.1",
  database: "reviews",
  password: null,
});

client.connect();

app.get("/reviews/", (req, res) => {
  let page = Number(req.query.page) || 1;
  let count = Number(req.query.count) || 5;

  let returnObj = {
    "product": req.query.product_id,
    "page": page,
    "count": count,
    "results": [],
  }

  client
    .query(`SELECT id, rating, summary, recommend, response, body, date, reviewer_name, reviewer_email, helpfulness FROM reviews WHERE product_id = ${req.query.product_id} limit ${count}`)
    .then((data) => {
      for (let review of data.rows) {
        if (!review.reported) {
          review["review_id"] = review["id"];
          returnObj["results"].push(review);
        }
      }

      for (let review of returnObj["results"]) {
        review.photos = [];
      }

      for (let review of returnObj["results"]) {
        client.query(`SELECT * FROM reviews_photos WHERE review_id = ${review.id}`)
          .then(data => {
            if (data.rows.length > 0) {
              for (let photo of data.rows) {
                review.photos.push({"id": photo.id, "url": photo.url});
              }

              res.status(200).send(returnObj);
            }
          })
          .catch(err => { throw err; });

      }
    })
    .catch((err) => {
      throw err;
    });
});

app.get("/reviews/meta", (req, res) => {
  console.log("/reviews/meta");
  res.status(200).send("/reviews/meta");
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
