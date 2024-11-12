import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'

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
        host: 'database-1.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
        port: 3306,
        user: 'admin',
        password: 'xyDbud-zevfof-8tizru',
      });
      const [results, fields] = await connection.query(
        'SELECT * FROM `first_table` WHERE `id` = 1'
      );
      console.log(results); // results contains rows returned by server
      console.log(fields); // fields contains extra meta data about results, if available
      const response:ResponseData = {
        success: true,
        message: `api/tests/s3 data!:`,
        data: {
          results,
          fields
        }
      }
      res.status(500).json(response)
    } catch (error) {
      console.log(`error: ${JSON.stringify(error)}`)
      const response:ResponseData = {
        success: false,
        message: `api/tests/s3 error: ${error}!`,
      }
      res.status(500).json(response)
    }
}