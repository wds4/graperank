import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, ListObjectsCommand } from '@aws-sdk/client-s3'
import mysql from 'mysql2/promise'
import { read } from '@/lib/neo4j'

/*
https://grapeRank.tech/api/stats/overviewWithEdits
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

    const cypher1 = `MATCH (n:NostrUser) RETURN n `
    const cypher1_result = await read(cypher1, {})

    const sql_users_0 = `SELECT id FROM users where flaggedToUpdateReverseObserveeObject=1 OR reverseObserveeObject IS NULL`
    const results_sql_users_0 = await connection.query(sql_users_0);
    const aUsers_0 = JSON.parse(JSON.stringify(results_sql_users_0[0]))

    const sql_events_count = `SELECT count(id) AS countId FROM events`
    const results_sql_events_count = await connection.query(sql_events_count);
    const aEvents_count = JSON.parse(JSON.stringify(results_sql_events_count[0]))

    const sql_events_3 = `SELECT id FROM events WHERE kind = 3`
    const results_sql_events_3 = await connection.query(sql_events_3);
    const aEvents_3 = JSON.parse(JSON.stringify(results_sql_events_3[0]))

    const sql_events_1984 = `SELECT id FROM events WHERE kind = 1984`
    const results_sql_events_1984 = await connection.query(sql_events_1984);
    const aEvents_1984 = JSON.parse(JSON.stringify(results_sql_events_1984[0]))

    const sql_events_10000 = `SELECT id FROM events WHERE kind = 10000`
    const results_sql_events_10000 = await connection.query(sql_events_10000);
    const aEvents_10000 = JSON.parse(JSON.stringify(results_sql_events_10000[0]))

    const sql_customers = `SELECT id FROM customers`
    const results_sql_customers = await connection.query(sql_customers);
    const aCustomers = JSON.parse(JSON.stringify(results_sql_customers[0]))

    const sql_users = `SELECT id FROM users`
    const results_sql_users = await connection.query(sql_users);
    const aUsers = JSON.parse(JSON.stringify(results_sql_users[0]))

    const sql_users_neverListened = `SELECT id FROM users WHERE whenLastListened IS NULL`
    const results_sql_users_neverListened = await connection.query(sql_users_neverListened);
    const aUsers_neverListened = JSON.parse(JSON.stringify(results_sql_users_neverListened[0]))

    const sql_users_yesKind3Event = `SELECT id FROM users WHERE kind3EventId IS NOT NULL`
    const results_sql_users_yesKind3Event = await connection.query(sql_users_yesKind3Event);
    const aUsers_yesKind3Event = JSON.parse(JSON.stringify(results_sql_users_yesKind3Event[0]))

    const sql_users_noKind3Event = `SELECT id FROM users WHERE kind3EventId IS NULL`
    const results_sql_users_noKind3Event = await connection.query(sql_users_noKind3Event);
    const aUsers_noKind3Event = JSON.parse(JSON.stringify(results_sql_users_noKind3Event[0]))

    const sql_users_noKind10000Event = `SELECT id FROM users WHERE kind10000EventId IS NULL`
    const results_sql_users_noKind10000Event = await connection.query(sql_users_noKind10000Event);
    const aUsers_noKind10000Event = JSON.parse(JSON.stringify(results_sql_users_noKind10000Event[0]))

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
      message: `api/stats/overviewWithEdits data:`,
      data: {
        duration,
        aEvents_count,
        sqlTableStats: {
          events: {
            total: aEvents_count[0].countId,
            kind3: aEvents_3.length,
            kind1984: aEvents_1984.length,
            kind10000: aEvents_10000.length,
          },
          users: {
            total: aUsers.length,
            neo4jNodes: cypher1_result.length,
            withKind3Event: aUsers_yesKind3Event.length,
            withoutKind3Event: aUsers_noKind3Event.length,
            withoutKind10000Event: aUsers_noKind10000Event.length,
            neverListenedForEvents: aUsers_neverListened.length,
          },
          customers: {
            total: aCustomers.length,
          },
        },
        cronJob0: {
          numEvents: aUsers_0.length,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/updateReverseObserveeObjects?n=300', 
          description: 'need to create reverseObserveeObject file',
        },
        cronJob1: {
          numEvents: numEvents1,
          endpoint: 'https://www.graperank.tech/api/dataManagement/transferEventsToEventsTableFromS3?n=200',
          description: 'events in s3 with Prefix: recentlyAddedEventsByEventId/',
        },
      }
    }
    res.status(200).json(response)
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/stats/overviewWithEdits error: ${error}!`,
    }
    res.status(500).json(response)
  }
}