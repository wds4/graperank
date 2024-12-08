import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, ListObjectsCommand } from '@aws-sdk/client-s3'
import mysql from 'mysql2/promise'

/*
usage:
https://www.graperank.tech/api/cronJobManager
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
const url1 = `https://www.graperank.tech/api/dataManagement/transferEventsToEventsTableFromS3?n=200`
const url2 = `https://www.graperank.tech/api/dataManagement/events/processKind3Events?n=1000`
const url2b = `https://www.graperank.tech/api/dataManagement/events/processKind10000Events?n=1000`
const url3 = `https://www.graperank.tech/api/dataManagement/users/processKind3Events?n=10`
const url3b = `https://www.graperank.tech/api/dataManagement/users/processKind10000Events?n=10`
const url4 = `https://www.graperank.tech/api/dataManagement/users/updateNeo4jNode?n=1000`
const url5 = `https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollowsAndFlagToUpRevObObj?n=5`
const url5b = `https://www.graperank.tech/api/dataManagement/users/updateNeo4jMutesByCsv?n=100`
const url6 = `https://graperank.tech/api/nostr/listeners/multipleUsers?n=900&kind3EventId=true`

// DEPRECATED
// const url0 = `https://www.graperank.tech/api/dataManagement/updateObserveeObjects?n=200`
// const url6 = `https://graperank.tech/api/nostr/listeners/multipleUsers?n=900&kind0EventId=true&kind3EventId&kind10000EventId=true`
// const url5 = `https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollowsByCsv?n=100` 

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
    let url = url6

    const data_s3 = await client.send(command_s3);
    console.log(`= data_s3: ${JSON.stringify(data_s3)}`)

    let numEvents1 = 0
    if (data_s3.Contents) {
      numEvents1 = data_s3.Contents.length
    }

    /*
    const sql0 = ` SELECT id FROM users WHERE ((kind3EventId IS NOT NULL) OR (kind10000EventId IS NOT NULL)) AND ((flaggedToUpdateObserveeObject=1) OR (observeeObject IS NULL)) `
    const results_sql0 = await connection.query(sql0);
    const aUsers0 = JSON.parse(JSON.stringify(results_sql0[0]))
    */

    const sql0 = ` SELECT id FROM users where flaggedToUpdateReverseObserveeObject=1 OR reverseObserveeObject IS NULL `
    const results_sql0 = await connection.query(sql0);
    const aUsers0 = JSON.parse(JSON.stringify(results_sql0[0]))

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
    const aUsers3b= JSON.parse(JSON.stringify(results_sql3b[0]))

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

    // if (aUsers6.length > 900) { url = url6 } // 900
    
    // if (aUsers5b.length > 0) { url = url5b } // 100
    if (aUsers4.length > 0) { url = url4 } // 1000
    if (aUsers3b.length > 0) { url = url3b } // 10
    if (aUsers3.length > 0) { url = url3 } // 10
    if (aEvents2.length > 1000) { url = url2 } // 1000
    if (aEvents2b.length > 1000) { url = url2b } // 1000
    if (numEvents1 > 200) { url = url1 } // 200
    if (aUsers0.length > 300) { url = url0 } // 300
    if (aUsers5.length > 5) { url = url5 } // 5

    console.log(`url: ${url}`)
    
    fetch(url)

    const response:ResponseData = {
      success: true,
      message: `api/cronJobManager data:`,
      data: {
        url,
        cronJob0: {
          numUsers: aUsers0.length,
          endpoint: url0,
          description: 'creating reverseObserveeObjects',
        },
        cronJob1: {
          numEvents: numEvents1,
          endpoint: url1,
          description: 'events in s3 with Prefix: recentlyAddedEventsByEventId/',
        },
        cronJob2: {
          numEventsToProcess: aEvents2.length,
          sql2,
          endpoint: url2,
          description: '',
        },
        cronJob2b: {
          numEventsToProcess: aEvents2b.length,
          sql2b,
          endpoint: url2b,
          description: '',
        },
        cronJob3: {
          numUsersToProcess: aUsers3.length,
          sql3,
          endpoint: url3,
          description: '',
        },
        cronJob3b: {
          numUsersToProcess: aUsers3b.length,
          sql3b,
          endpoint: url3b,
          description: '',
        },
        cronJob4: {
          numUsersToProcess: aUsers4.length,
          sql4,
          endpoint: url4,
          description: '',
        },
        cronJob5: {
          numUsersToProcess: aUsers5.length,
          sql5,
          endpoint: url5,
          description: '',
        },
        cronJob5b: {
          numUsersToProcess: aUsers5b.length,
          sql5b,
          endpoint: url5b,
          description: '',
        },
        cronJob6: {
          numUsersToProcess: aUsers6.length,
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
      message: `api/cronJobManager error: ${error}!`,
    }
    res.status(500).json(response)
  }
}
