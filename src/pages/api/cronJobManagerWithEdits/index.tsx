import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, ListObjectsCommand } from '@aws-sdk/client-s3'
import mysql from 'mysql2/promise'

/*
usage:
https://www.graperank.tech/api/cronJobManagerWithEdits
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


const url0 = `https://www.graperank.tech/api/dataManagement/users/updateReverseObserveeObjects?n=300`
const url1 = `https://www.graperank.tech/api/dataManagement/transferEventsToEventsTableFROMS3?n=200`
const url2 = `https://www.graperank.tech/api/dataManagement/events/processKind3Events?n=1000`
const url2b = `https://www.graperank.tech/api/dataManagement/events/processKind10000Events?n=1000`
const url3 = `https://www.graperank.tech/api/dataManagement/users/processKind3Events?n=10`
const url3b = `https://www.graperank.tech/api/dataManagement/users/processKind10000Events?n=10`
const url4 = `https://www.graperank.tech/api/dataManagement/users/updateNeo4jNode?n=1000`
const url5 = `https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollowsAndFlagToUpRevObObj?n=20`
const url5b = `https://www.graperank.tech/api/dataManagement/users/updateNeo4jMutesAndFlagToUpRevObObj?n=10`
const url6 = `https://graperank.tech/api/nostr/listeners/multipleUsers?n=900&kind3EventId=true`

// DEPRECATED
// const url0 = `https://www.graperank.tech/api/dataManagement/updateObserveeObjects?n=200`
// const url6 = `https://graperank.tech/api/nostr/listeners/multipleUsers?n=900&kind0EventId=true&kind3EventId&kind10000EventId=true`
// const url5 = `https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollowsByCsv?n=100` 
// const url5b = `https://www.graperank.tech/api/dataManagement/users/updateNeo4jMutesByCsv?n=100`

type ResponseData = {
  success: boolean,
  message: string,
  data?: object
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

    const data_s3 = await client.send(command_s3);
    console.log(`= data_s3: ${JSON.stringify(data_s3)}`)

    let numEvents1 = 0
    if (data_s3.Contents) {
      numEvents1 = data_s3.Contents.length
    }

    const sql0 = ` SELECT count(id) AS countId FROM users where flaggedToUpdateReverseObserveeObject=1 OR reverseObserveeObject IS NULL `
    const results_sql0 = await connection.query(sql0);
    const aUsers0_count = JSON.parse(JSON.stringify(results_sql0[0]))[0].countId

    const sql2 = ` SELECT count(id) AS countId FROM events where kind=3 and flaggedForProcessing=1 `
    const results_sql2 = await connection.query(sql2);
    const aEvents2_count = JSON.parse(JSON.stringify(results_sql2[0]))[0].countId

    const sql2b = ` SELECT count(id) AS countId FROM events where kind=10000 and flaggedForProcessing=1 `
    const results_sql2b = await connection.query(sql2b);
    const aEvents2b_count = JSON.parse(JSON.stringify(results_sql2b[0]))[0].countId

    const sql3 = `SELECT count(id) AS countId FROM users WHERE flaggedForKind3EventProcessing=1;`
    const results_sql3 = await connection.query(sql3);
    const aUsers3_count = JSON.parse(JSON.stringify(results_sql3[0]))[0].countId

    const sql3b = `SELECT count(id) AS countId FROM users WHERE flaggedForKind10000EventProcessing=1;`
    const results_sql3b = await connection.query(sql3b);
    const aUsers3b_count = JSON.parse(JSON.stringify(results_sql3b[0]))[0].countId

    const sql4 = `SELECT count(id) AS countId FROM users where flaggedToUpdateNeo4jNode=1;`
    const results_sql4 = await connection.query(sql4);
    const aUsers4_count = JSON.parse(JSON.stringify(results_sql4[0]))[0].countId

    const sql5 = `SELECT count(id) AS countId FROM users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0;`
    const results_sql5 = await connection.query(sql5);
    const aUsers5_count = JSON.parse(JSON.stringify(results_sql5[0]))[0].countId

    const sql5b = `SELECT count(id) AS countId FROM users where flaggedToUpdateNeo4jMutes=1 AND flaggedToUpdateNeo4jNode=0;`
    const results_sql5b = await connection.query(sql5b);
    const aUsers5b_count = JSON.parse(JSON.stringify(results_sql5b[0]))[0].countId

    const sql6 = `SELECT count(id) AS countId FROM users WHERE kind3EventId IS NULL;`
    const results_sql6 = await connection.query(sql6);
    const aUsers6_count = JSON.parse(JSON.stringify(results_sql6[0]))[0].countId

    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)

    // let url = url6
    let url = ``

    if (aUsers6_count > 900) { url = url6 } // 900

    if (aUsers5b_count > 0) { url = url5b } // 10
    if (aUsers5_count > 0) { url = url5 } // 5
    if (aEvents2_count > 0) { url = url2 } // 1000
    if (aEvents2b_count > 0) { url = url2b } // 1000
    if (numEvents1 > 0) { url = url1 } // 200
    if (aUsers0_count > 0) { url = url0 } // 300

    if (aUsers4_count > 0) { url = url4 } // 1000
    if (aUsers5b_count > 10) { url = url5b } // 10
    if (aUsers5_count > 5) { url = url5 } // 5
    if (aUsers3b_count > 0) { url = url3b } // 10
    if (aUsers3_count > 0) { url = url3 } // 10
    if (aEvents2_count > 1000) { url = url2 } // 1000
    if (aEvents2b_count > 1000) { url = url2b } // 1000
    if (numEvents1 > 200) { url = url1 } // 200
    if (aUsers0_count > 300) { url = url0 } // 300

    console.log(`url: ${url}`)

    const currentTimestamp_finish = Math.floor(Date.now() / 1000)

    const duration = currentTimestamp_finish - currentTimestamp_start
    
    if (url) {
      // fetch(url)
    }

    const response:ResponseData = {
      success: true,
      message: `api/cronJobManager data:`,
      data: {
        url,
        duration,
        cronJob0: {
          numUsers: aUsers0_count,
          endpoint: url0,
          description: 'creating reverseObserveeObjects',
        },
        cronJob1: {
          numEvents: numEvents1,
          endpoint: url1,
          description: 'events in s3 with Prefix: recentlyAddedEventsByEventId/',
        },
        cronJob2: {
          numEventsToProcess: aEvents2_count,
          sql2,
          endpoint: url2,
          description: '',
        },
        cronJob2b: {
          numEventsToProcess: aEvents2b_count,
          sql2b,
          endpoint: url2b,
          description: '',
        },
        cronJob3: {
          numUsersToProcess: aUsers3_count,
          sql3,
          endpoint: url3,
          description: '',
        },
        cronJob3b: {
          numUsersToProcess: aUsers3b_count,
          sql3b,
          endpoint: url3b,
          description: '',
        },
        cronJob4: {
          numUsersToProcess: aUsers4_count,
          sql4,
          endpoint: url4,
          description: '',
        },
        cronJob5: {
          numUsersToProcess: aUsers5_count,
          sql5,
          endpoint: url5,
          description: '',
        },
        cronJob5b: {
          numUsersToProcess: aUsers5b_count,
          sql5b,
          endpoint: url5b,
          description: '',
        },
        cronJob6: {
          numUsersToProcess: aUsers6_count,
          sql6,
          endpoint: url6,
          description: '',
        },
      }
    }
    res.status(200).json(response)
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/cronJobManagerWithEdits error: ${error}!`,
    }
    res.status(500).json(response)
  }
}
