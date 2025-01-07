import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'

/*
https://www.graperank.tech/api/tests/sql
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
      const [results, fields] = await connection.query(
        'SELECT count(id) AS countCustomers FROM `customers`'
      );
      console.log(results); // results contains rows returned by server
      console.log(fields); // fields contains extra meta data about results, if available

      const close_result = await connection.end()
      console.log(`closing connection: ${close_result}`)
      
      const response:ResponseData = {
        success: true,
        message: `api/tests/sql data:`,
        data: {
          results,
          fields
        }
      }
      res.status(200).json(response)
    } catch (error) {
      console.log(`error: ${JSON.stringify(error)}`)
      const response:ResponseData = {
        success: false,
        message: `api/tests/sql; user: ${process.env.AWS_MYSQL_USER} error: ${error}!`,
      }
      res.status(500).json(response)
    }
}