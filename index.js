const { Pool, Client } = require('pg');

express = require('express');
const app = express();


const pool = new Pool({
  user: 'kyelindholm',
  host: '127.0.0.1',
  database: 'reviews',
  password: null,
});

const client = new Client({
  user: 'kyelindholm',
  host: '127.0.0.1',
  database: 'reviews',
  password: null,
});

client.connect();

const PORT = 3000;

app.get('/test', (req, res) => {
  pool.query('select * from reviews where id=5', (err, response) => {
    console.log('recieved request!');
    if (err) return console.log(err);

    res.send(response.rows);
  });
});





app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});