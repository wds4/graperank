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
      const results1 = await connection.query(command1);
      console.log(results1);

      const command2 = `DROP TABLE IF EXISTS users; `
      const results2 = await connection.query(command2);
      console.log(results2);

      const command3 = `DROP TABLE IF EXISTS customers; `
      const results3 = await connection.query(command3);
      console.log(results3);

      const close_result = await connection.end()
      console.log(`closing connection: ${close_result}`)
      
      const response:ResponseData = {
        success: true,
        message: `api/sql/deleteTables data:`,
        data: {
          results1, results2, results3
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