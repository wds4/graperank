import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, ListObjectsCommand } from '@aws-sdk/client-s3'
import mysql from 'mysql2/promise'

/*
https://grapeRank.tech/api/stats/overviewWithEdits2
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

    const sql_threads = `show status where variable_name = 'threads_connected';`
    const results_sql_threads = await connection.query(sql_threads);
    const mysqlThreadCount = Number(JSON.parse(JSON.stringify(results_sql_threads[0]))[0].Value)

    const sql_users_0 = `SELECT id FROM users where flaggedToUpdateReverseObserveeObject=1 OR reverseObserveeObject IS NULL`
    const results_sql_users_0 = await connection.query(sql_users_0);
    const aUsers_0 = JSON.parse(JSON.stringify(results_sql_users_0[0]))

    const sql_events_count = `SELECT count(id) AS countId FROM events`
    const results_sql_events_count = await connection.query(sql_events_count);
    const aEvents_count = JSON.parse(JSON.stringify(results_sql_events_count[0]))

    const sql2 = ` SELECT id FROM events where kind=3 and flaggedForProcessing=1 `
    const results_sql2 = await connection.query(sql2);
    const aEvents2 = JSON.parse(JSON.stringify(results_sql2[0]))
    
    const sql2b = ` SELECT id FROM events where kind=10000 and flaggedForProcessing=1 `
    const results_sql2b = await connection.query(sql2b);
    const aEvents2b = JSON.parse(JSON.stringify(results_sql2b[0]))

    const sql3 = `SELECT id from users WHERE flaggedForKind3EventProcessing=1;`
    const results_sql3 = await connection.query(sql3);
    const aUsers3= JSON.parse(JSON.stringify(results_sql3[0]))

    const sql3b = `SELECT id from users WHERE flaggedForKind10000EventProcessing=1;`
    const results_sql3b = await connection.query(sql3b);
    const aUsers10000= JSON.parse(JSON.stringify(results_sql3b[0]))

    const sql4 = `SELECT id FROM users where flaggedToUpdateNeo4jNode=1;`
    const results_sql4 = await connection.query(sql4);
    const aUsers4= JSON.parse(JSON.stringify(results_sql4[0]))

    const sql5 = `SELECT id FROM users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0;`
    const results_sql5 = await connection.query(sql5);
    const aUsers5= JSON.parse(JSON.stringify(results_sql5[0]))

    const sql5b = `SELECT id FROM users where flaggedToUpdateNeo4jMutes=1 AND flaggedToUpdateNeo4jNode=0;`
    const results_sql5b = await connection.query(sql5b);
    const aUsers5b= JSON.parse(JSON.stringify(results_sql5b[0]))

    const sql6 = `SELECT id FROM users WHERE kind3EventId IS NULL;`
    const results_sql6 = await connection.query(sql6);
    const aUsers6= JSON.parse(JSON.stringify(results_sql6[0]))

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
        mysqlThreadCount,
        aEvents_count,
        cronJob0: {
          numUsersNeedingReverseObserveeObjectUpdate: aUsers_0.length,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/updateReverseObserveeObjects?n=300', 
          description: 'need to create reverseObserveeObject file',
        },
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
        cronJob3: {
          numUsersToProcess: aUsers3.length,
          sql3,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/processKind3Events?n=8',
          description: '',
        },
        cronJob3b: {
          numUsersToProcess: aUsers10000.length,
          sql3b,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/processKind10000Events?n=10',
          description: '',
        },
        cronJob4: {
          numUsersToProcess: aUsers4.length,
          sql4,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/updateNeo4jNode?n=1000',
          description: '',
        },
        cronJob5: {
          numUsersToProcess: aUsers5.length,
          sql5,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollowsAndFlagToUpRevObObj?n=20',
          description: '',
        },
        cronJob5b: {
          numUsersToProcess: aUsers5b.length,
          sql5b,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/updateNeo4jMutesAndFlagToUpRevObObj?n=10',
          description: '',
        },
        cronJob6: {
          numUsersToProcess: aUsers6.length,
          sql6,
          endpoint: 'https://graperank.tech/api/nostr/listeners/multipleUsers?n=900&kind3EventId=true',
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