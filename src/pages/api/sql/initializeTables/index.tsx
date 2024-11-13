import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'

/*
https://www.graperank.tech/api/sql/initializeTables
*/

type ResponseData = {
  success: boolean,
  message: string,
  data?: object,
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
    try {
      const connection = await mysql.createConnection({
        host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
        port: 3306,
        user: process.env.AWS_MYSQL_USER,
        password: process.env.AWS_MYSQL_PWD,
        database: process.env.AWS_MYSQL_DB,
      });

      let command1 = `CREATE TABLE IF NOT EXISTS events ( `
      command1 += ` id INT PRIMARY KEY, `
      command1 += ` pubkey VARCHAR(255), `
      command1 += ` eventID VARCHAR(255) UNIQUE, `
      command1 += ` created_at INT, `
      command1 += ` kind INT `
      command1 += ` ); `
      const results1 = await connection.query(command1);
      console.log(results1);

      let command2 = ` CREATE TABLE IF NOT EXISTS users ( `
      command2 += ` id INT PRIMARY KEY, `
      command2 += ` pubkey VARCHAR(255) UNIQUE, `
      command2 += ` npub VARCHAR(255) UNIQUE, `
      command2 += ` kind3EventId int, `
      command2 += ` kind10000EventId int, `
      command2 += ` whenLastListened int `
      command2 += ` ); `
      const results2 = await connection.query(command2);
      console.log(results2);

      const response:ResponseData = {
        success: true,
        message: `api/sql/initializeTables data:`,
        data: {
          results1, results2,
        }
      }
      res.status(500).json(response)
    } catch (error) {
      console.log(`error: ${JSON.stringify(error)}`)
      const response:ResponseData = {
        success: false,
        message: `api/sql/initializeTables error: ${error}!`,
      }
      res.status(500).json(response)
    }
}