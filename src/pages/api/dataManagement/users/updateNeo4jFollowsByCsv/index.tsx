import type { NextApiRequest, NextApiResponse } from 'next'
// import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
// import { validateEvent } from 'nostr-tools'
// import { NostrEvent } from "@nostr-dev-kit/ndk"
import mysql from 'mysql2/promise'
// import { isValidPubkey } from '@/helpers/nip19'
// import { write } from '@/lib/neo4j'

/*
- select * from users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0 (wait until parent node is properly updated)
for each row:
  - get const pubkey_parent, const kind3EventId
  - cypher1: access https://graperank.tech/api/neo4j/generateCsv/fromSingleKind3EventId?kind3EventId=... and execute via csv import
  // TODO: finish

  // cleaning up
  - sql2: UPDATE users SET flaggedToUpdateNeo4jFollows = 0 WHERE pubkey=pubkey_parent

usage:

http://localhost:3000/api/dataManagement/users/updateNeo4jFollowsByCsv?n=1

https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollowsByCsv?n=1

*/
/*
const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})
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
  const searchParams = req.query
  let numUsersToProcess = 1;
  if (searchParams.n && typeof searchParams.n == 'string') {
    numUsersToProcess = Number(searchParams.n)
  }
  console.log(`numUsersToProcess: ${numUsersToProcess}`)

  const connection = await mysql.createConnection({
    host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: process.env.AWS_MYSQL_USER,
    password: process.env.AWS_MYSQL_PWD,
    database: process.env.AWS_MYSQL_DB,
  });

  try {
    const sql1 = ` SELECT * FROM users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0 `
    const results1 = await connection.query(sql1);
    const aUsers = JSON.parse(JSON.stringify(results1[0]))
    const aPubkeysDiscovered = []
    for (let x=0; x < Math.min(numUsersToProcess, aUsers.length); x++) {
      const oNextUser = aUsers[x]
      const pubkey_parent = oNextUser.pubkey
      const kind3EventId = oNextUser.kind3EventId
      console.log(kind3EventId)
      // TODO: finish      








      // cleaning up 
      const sql2 = ` UPDATE users SET flaggedToUpdateNeo4jFollows = 0 WHERE pubkey='${pubkey_parent}' `
      const sql2_results = await connection.query(sql2);
      console.log(sql2_results)
    }

    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)
    
    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/users/updateNeo4jFollowsByCsv data:`,
      data: { 
        numUsers: aUsers.length, 
        numPubkeysDiscovered: aPubkeysDiscovered.length,
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/users/updateNeo4jFollowsByCsv error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}