import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, ListObjectsCommand } from '@aws-sdk/client-s3'
import mysql from 'mysql2/promise'
// import { read } from '@/lib/neo4j'

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
    /*
    const cypher1 = `MATCH (n:NostrUser) RETURN count(n) AS countNostrUsers `
    const cypher1_result = await read(cypher1, {})
    const numNeo4jUsers = JSON.parse(JSON.stringify(cypher1_result))[0].countNostrUsers.low
  */

    /*
    const sql_users_0_count = `SELECT count(id) AS countId FROM users where flaggedToUpdateReverseObserveeObject=1 OR reverseObserveeObject IS NULL`
    const results_sql_users_0_count = await connection.query(sql_users_0_count);
    const aUsers_0_count = JSON.parse(JSON.stringify(results_sql_users_0_count[0]))[0].countId
    */
    
    const sql_events_count = `SELECT count(id) AS countId FROM events`
    const results_sql_events_count = await connection.query(sql_events_count);
    const aEvents_count = JSON.parse(JSON.stringify(results_sql_events_count[0]))[0].countId

    const sql_events_3 = `SELECT count(id) AS countId FROM events WHERE kind = 3`
    const results_sql_events_3 = await connection.query(sql_events_3);
    const aEvents_3 = JSON.parse(JSON.stringify(results_sql_events_3[0]))[0].countId

    const sql_events_1984 = `SELECT count(id) AS countId FROM events WHERE kind = 1984`
    const results_sql_events_1984 = await connection.query(sql_events_1984);
    const aEvents_1984 = JSON.parse(JSON.stringify(results_sql_events_1984[0]))[0].countId

    const sql_events_10000 = `SELECT count(id) AS countId FROM events WHERE kind = 10000`
    const results_sql_events_10000 = await connection.query(sql_events_10000);
    const aEvents_10000 = JSON.parse(JSON.stringify(results_sql_events_10000[0]))[0].countId

    /*
    const sql_customers = `SELECT count(id) AS countId FROM customers`
    const results_sql_customers = await connection.query(sql_customers);
    const aCustomers = JSON.parse(JSON.stringify(results_sql_customers[0]))[0].countId

    const sql_users = `SELECT count(id) AS countId FROM users`
    const results_sql_users = await connection.query(sql_users);
    const aUsers = JSON.parse(JSON.stringify(results_sql_users[0]))[0].countId

    const sql_users_neverListened = `SELECT count(id) AS countId FROM users WHERE whenLastListened IS NULL`
    const results_sql_users_neverListened = await connection.query(sql_users_neverListened);
    const aUsers_neverListened = JSON.parse(JSON.stringify(results_sql_users_neverListened[0]))[0].countId

    const sql_users_yesKind3Event = `SELECT count(id) AS countId FROM users WHERE kind3EventId IS NOT NULL`
    const results_sql_users_yesKind3Event = await connection.query(sql_users_yesKind3Event);
    const aUsers_yesKind3Event = JSON.parse(JSON.stringify(results_sql_users_yesKind3Event[0]))[0].countId

    const sql_users_noKind3Event = `SELECT count(id) AS countId FROM users WHERE kind3EventId IS NULL`
    const results_sql_users_noKind3Event = await connection.query(sql_users_noKind3Event);
    const aUsers_noKind3Event = JSON.parse(JSON.stringify(results_sql_users_noKind3Event[0]))[0].countId

    const sql_users_noKind10000Event = `SELECT count(id) AS countId FROM users WHERE kind10000EventId IS NULL`
    const results_sql_users_noKind10000Event = await connection.query(sql_users_noKind10000Event);
    const aUsers_noKind10000Event = JSON.parse(JSON.stringify(results_sql_users_noKind10000Event[0]))[0].countId

    const sql2 = ` SELECT count(id) AS countId FROM events where kind=3 and flaggedForProcessing=1 `
    const results_sql2 = await connection.query(sql2);
    const aEvents2 = JSON.parse(JSON.stringify(results_sql2[0]))[0].countId
    
    const sql2b = ` SELECT count(id) AS countId FROM events where kind=10000 and flaggedForProcessing=1 `
    const results_sql2b = await connection.query(sql2b);
    const aEvents2b = JSON.parse(JSON.stringify(results_sql2b[0]))[0].countId

    const sql3 = `SELECT count(id) AS countId from users WHERE flaggedForKind3EventProcessing=1;`
    const results_sql3 = await connection.query(sql3);
    const aUsers3= JSON.parse(JSON.stringify(results_sql3[0]))[0].countId

    const sql3b = `SELECT count(id) AS countId from users WHERE flaggedForKind10000EventProcessing=1;`
    const results_sql3b = await connection.query(sql3b);
    const aUsers10000= JSON.parse(JSON.stringify(results_sql3b[0]))[0].countId

    const sql4 = `SELECT count(id) AS countId FROM users where flaggedToUpdateNeo4jNode=1;`
    const results_sql4 = await connection.query(sql4);
    const aUsers4= JSON.parse(JSON.stringify(results_sql4[0]))[0].countId

    const sql5 = `SELECT count(id) AS countId FROM users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0;`
    const results_sql5 = await connection.query(sql5);
    const aUsers5= JSON.parse(JSON.stringify(results_sql5[0]))[0].countId

    const sql5b = `SELECT count(id) AS countId FROM users where flaggedToUpdateNeo4jMutes=1 AND flaggedToUpdateNeo4jNode=0;`
    const results_sql5b = await connection.query(sql5b);
    const aUsers5b= JSON.parse(JSON.stringify(results_sql5b[0]))[0].countId

    const sql6 = `SELECT count(id) AS countId FROM users WHERE kind3EventId IS NULL;`
    const results_sql6 = await connection.query(sql6);
    const aUsers6= JSON.parse(JSON.stringify(results_sql6[0]))[0].countId
       */
    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)

    const data_s3 = await client.send(command_s3);
    console.log(`= data_s3: ${JSON.stringify(data_s3)}`)

    /*
    let numEvents1 = -1
    if (data_s3.Contents) {
      numEvents1 = data_s3.Contents.length
    }
      */

    const response:ResponseData = {
      success: true,
      message: `api/stats/overview data:`,
      data: {
        sqlTableStats: {
          events: {
            total: aEvents_count,
            kind3: aEvents_3,
            kind1984: aEvents_1984,
            kind10000: aEvents_10000,
          },
          /*
          users: {
            total: aUsers,
            // numNeo4jUsers,
            // neo4jNodes: cypher1_result,
            // neo4jNodes: cypher1_result[0].countNostrUsers.low,
            // cypher1_result,
            withKind3Event: aUsers_yesKind3Event,
            withoutKind3Event: aUsers_noKind3Event,
            withoutKind10000Event: aUsers_noKind10000Event,
            neverListenedForEvents: aUsers_neverListened,
          },
          customers: {
            total: aCustomers,
          },
        */
        },
        /*
        cronJob0: {
          numEvents: aUsers_0_count,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/updateReverseObserveeObjects?n=300', 
          description: 'need to create reverseObserveeObject file',
        },
        cronJob1: {
          numEvents: numEvents1,
          endpoint: 'https://www.graperank.tech/api/dataManagement/transferEventsToEventsTableFromS3?n=200',
          description: 'events in s3 with Prefix: recentlyAddedEventsByEventId/',
        },
        cronJob2: {
          numEventsToProcess: aEvents2,
          sql2,
          endpoint: 'https://www.graperank.tech/api/dataManagement/events/processKind3Events?n=1000',
          description: '',
        },
        cronJob2b: {
          numEventsToProcess: aEvents2b,
          sql2b,
          endpoint: 'https://www.graperank.tech/api/dataManagement/events/processKind10000Events?n=1000',
          description: '',
        },
        cronJob3: {
          numUsersToProcess: aUsers3,
          sql3,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/processKind3Events?n=10',
          description: '',
        },
        cronJob3b: {
          numUsersToProcess: aUsers10000,
          sql3b,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/processKind10000Events?n=10',
          description: '',
        },
        cronJob4: {
          numUsersToProcess: aUsers4,
          sql4,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/updateNeo4jNode?n=1000',
          description: '',
        },
        cronJob5: {
          numUsersToProcess: aUsers5,
          sql5,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollowsAndFlagToUpRevObObj?n=20',
          description: '',
        },
        cronJob5b: {
          numUsersToProcess: aUsers5b,
          sql5b,
          endpoint: 'https://www.graperank.tech/api/dataManagement/users/updateNeo4jMutesAndFlagToUpRevObObj?n=10',
          description: '',
        },
        cronJob6: {
          numUsersToProcess: aUsers6,
          sql6,
          endpoint: 'https://graperank.tech/api/nostr/listeners/multipleUsers?n=900&kind3EventId=true',
          description: '',
        },
        */
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