import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'

/*
https://www.graperank.tech/api/sql/deleteTables
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
      const command1 = `DROP TABLE IF EXISTS events; `
      // const command2 = `DROP TABLE IF EXISTS users; `
      const results = await connection.query(command1);
      console.log(results); // results contains rows returned by server
      const response:ResponseData = {
        success: true,
        message: `api/sql/deleteTables data:`,
        data: {
          results,
        }
      }
      res.status(500).json(response)
    } catch (error) {
      console.log(`error: ${JSON.stringify(error)}`)
      const response:ResponseData = {
        success: false,
        message: `api/sql/deleteTables error: ${error}!`,
      }
      res.status(500).json(response)
    }
}