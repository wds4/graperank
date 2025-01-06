import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, ListObjectsCommand } from '@aws-sdk/client-s3'
import mysql from 'mysql2/promise'
import { read } from '@/lib/neo4j'

/*
https://grapeRank.tech/api/stats/overview
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
    const cypher1 = `MATCH (n:NostrUser) RETURN n `
    const cypher1_result = await read(cypher1, {})

    const sql_users_0 = `SELECT id FROM users where flaggedToUpdateReverseObserveeObject=1 OR reverseObserveeObject IS NULL`
    const results_sql_users_0 = await connection.query(sql_users_0);
    const aUsers_0 = JSON.parse(JSON.stringify(results_sql_users_0[0]))

    const sql_events = `SELECT id FROM events`
    const results_sql_events = await connection.query(sql_events);
    const aEvents = JSON.parse(JSON.stringify(results_sql_events[0]))

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

    const response:ResponseData = {
      success: true,
      message: `api/stats/overview data:`,
      data: {
        aEvents_count,
        sqlTableStats: {
          events: {
            total: aEvents.length,
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
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/processKind3Events?n=10',
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
      message: `api/stats/overview error: ${error}!`,
    }
    res.status(500).json(response)
  }
}