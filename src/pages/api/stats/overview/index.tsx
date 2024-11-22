import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'

/*
https://grapeRank.tech/api/stats/overview
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
  const connection = await mysql.createConnection({
    host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: process.env.AWS_MYSQL_USER,
    password: process.env.AWS_MYSQL_PWD,
    database: process.env.AWS_MYSQL_DB,
  });

  try {
    const sql1 = ` SELECT * FROM events where kind=3 and flaggedForProcessing=1 `
    const results_sql1 = await connection.query(sql1);
    const aEvents = JSON.parse(JSON.stringify(results_sql1[0]))

    const response:ResponseData = {
      success: true,
      message: `api/stats/overview data:`,
      data: {
        cronJob2: {
          numEventsToProcess: aEvents.length 
        }
      }
    }
    res.status(200).json(response)
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/stats/overview error: ${error}!`,
    }
    res.status(500).json(response)
  }
}