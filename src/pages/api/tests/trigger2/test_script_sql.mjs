// eslint-disable-next-line @typescript-eslint/no-require-imports
// const mysql = require('mysql2');
import mysql from 'mysql2/promise'

console.log('Node.js test_script_sql.mjs executed!');
// Perform your desired operations here

const connection = await mysql.createConnection({
  host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'pgft',
  password: 'vehZyt-cuspuj-8ruvma',
  database: 'grapevineNostrCacheDb',
});

const command0 = `show tables; `
const [results] = await connection.query(command0);
console.log(`command0 results: ${JSON.stringify(results, null, 4)}`);

const secondSqlCommand = async () => {
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const command1 = `UPDATE testTable SET whenupdated = ${currentTimestamp} WHERE name = 'fred'; `
  const [results] = await connection.query(command1);
  console.log(`command1 results: ${JSON.stringify(results, null, 4)}`);
}

await secondSqlCommand()

/*
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL!');
});

const command0 = `show tables; `
connection.query(command0, (err, results) => {
    if (err) {
        console.error('Error executing command0 query:', err);
        return;
    }
    console.log(`command0 results: ${JSON.stringify(results, null, 4)}`);
});

const currentTimestamp = Math.floor(Date.now() / 1000)

const command1 = `UPDATE testTable SET whenupdated = ${currentTimestamp} WHERE name = 'fred'; `
connection.query(command1, (err, results) => {
    if (err) {
        console.error('Error executing command1 query:', err);
        return;
    }
    console.log(`command1 results: ${JSON.stringify(results, null, 4)}`);
});
*/

const close_result = await connection.end()
console.log(`closing connection: ${JSON.stringify(close_result)}`)

console.log('end of script!!');
