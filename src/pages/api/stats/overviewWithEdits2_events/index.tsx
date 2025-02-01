import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, ListObjectsCommand } from '@aws-sdk/client-s3'
import mysql from 'mysql2/promise'

/*
https://grapeRank.tech/api/stats/overviewWithEdits2_events
*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

const params = {
  Bucket: 'grapevine-nostr-cache-bucket',
  Prefix: 'recentlyAddedEventsByEventId',
};

const command_s3 = new ListObjectsCommand(params);

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
    const currentTimestamp_start = Math.floor(Date.now() / 1000)

    const sql_events_count = `SELECT count(id) AS countId FROM events`
    const results_sql_events_count = await connection.query(sql_events_count);
    const aEvents_count = JSON.parse(JSON.stringify(results_sql_events_count[0]))

    const sql2 = ` SELECT id FROM events where kind=3 and flaggedForProcessing=1 `
    const results_sql2 = await connection.query(sql2);
    const aEvents2 = JSON.parse(JSON.stringify(results_sql2[0]))
    
    const sql2b = ` SELECT id FROM events where kind=10000 and flaggedForProcessing=1 `
    const results_sql2b = await connection.query(sql2b);
    const aEvents2b = JSON.parse(JSON.stringify(results_sql2b[0]))

    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)

    const data_s3 = await client.send(command_s3);
    console.log(`= data_s3: ${JSON.stringify(data_s3)}`)

    let numEvents1 = -1
    if (data_s3.Contents) {
      numEvents1 = data_s3.Contents.length
    }

    const currentTimestamp_finish = Math.floor(Date.now() / 1000)

    const duration = currentTimestamp_finish - currentTimestamp_start

    const response:ResponseData = {
      success: true,
      message: `api/stats/overviewWithEdits2 data:`,
      data: {
        duration,
        aEvents_count,
        cronJob1: {
          numEvents: numEvents1,
          endpoint: 'https://www.graperank.tech/api/dataManagement/transferEventsToEventsTableFromS3?n=200',
          description: 'events in s3 with Prefix: recentlyAddedEventsByEventId/',
        },
        cronJob2: {
          numEventsToProcess: aEvents2.length,
          sql2,
          endpoint: 'https://www.graperank.tech/api/dataManagement/events/processKind3Events?n=1000',
          description: '',
        },
        cronJob2b: {
          numEventsToProcess: aEvents2b.length,
          sql2b,
          endpoint: 'https://www.graperank.tech/api/dataManagement/events/processKind10000Events?n=1000',
          description: '',
        },
      }
    }
    res.status(200).json(response)
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/stats/overviewWithEdits2 error: ${error}!`,
    }
    res.status(500).json(response)
  }
}