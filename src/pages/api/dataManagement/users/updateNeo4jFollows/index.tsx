import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { validateEvent } from 'nostr-tools'
import { NostrEvent } from "@nostr-dev-kit/ndk"
import mysql from 'mysql2/promise'
import { isValidPubkey } from '@/helpers/nip19'
import { write } from '@/lib/neo4j'

/*
- select * from users where flaggedToUpdateNeo4jFollows=1
for each row:
  - get const pubkey_parent, const kind3EventId
  - cypher1: add node for pubkey_parent if does not already exist
  - cypher2: remove all FOLLOWS edges starting at pubkey_parent
  - s31: get kind3Event using kind3EventId
  - cycle through each pubkey_child in kind3Event:
    - const pubkey_child
    - cypher3: add edge FOLLOWS from pubkey_parent to pubkey_child
  // cleaning up
  - sql4: UPDATE users SET flaggedToUpdateNeo4jFollows = 0 WHERE pubkey=pubkey_parent

usage:

http://localhost:3000/api/dataManagement/users/updateNeo4jFollows?n=1

https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollows?n=1

*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

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
    const sql1 = ` SELECT * FROM users where flaggedToUpdateNeo4jFollows=1 `
    const results1 = await connection.query(sql1);
    const aUsers = JSON.parse(JSON.stringify(results1[0]))
    const aPubkeysDiscovered = []
    const aCypherResults = []
    for (let x=0; x < Math.min(numUsersToProcess, aUsers.length); x++) {
      const oNextUser = aUsers[x]
      const pubkey_parent = oNextUser.pubkey
      const kind3EventId = oNextUser.kind3EventId

      // cypher1: add node pubkey_parent if not already exists
      const cypher1 = `MERGE (n:NostrUser {pubkey: '${pubkey_parent}'}) RETURN n.pubkey AS pubkey `
      const result1 = await write(cypher1, {})
      console.log(result1)
      aCypherResults.push({cypher1, result1})

      
      // cypher2: remove all FOLLOWS edges starting at pubkey_parent
      const cypher2 = ` MATCH (n:NostrUser {pubkey: '${pubkey_parent}'})-[f:FOLLOWS]->(m:NostrUser) 
      REMOVE f 
      RETURN m `
      aCypherResults.push({cypher2})
      /*
      const result2 = await write(cypher2, {})
      console.log(result2)
      aCypherResults.push({cypher2, result2})
      */

      if (kind3EventId) {
        const params_get = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: 'eventsByEventId/' + kind3EventId,
        }
        const command_s3_get = new GetObjectCommand(params_get);
        const data_get = await client.send(command_s3_get);
        console.log(data_get)
        const sEvent = await data_get.Body?.transformToString()
        if (typeof sEvent == 'string') {
          const oKind3Event:NostrEvent = JSON.parse(sEvent) 
          const isEventValid = validateEvent(oKind3Event)
          if (isEventValid) {
            // cycle through each pubkey_child in kind3Event and add edge FOLLOWS from pubkey_parent to pubkey_child
            const aTags = oKind3Event.tags
            for (let t=0; t < aTags.length; t++) {
              const aTag = aTags[t]
              if (aTag && aTag[0] == 'p' && aTag[1] && isValidPubkey(aTag[1])) {
                const pubkey_child = aTag[1]
                console.log(pubkey_child)
                aPubkeysDiscovered.push(pubkey_child)
                // cypher2: add edge FOLLOWS from pubkey_parent to pubkey_child
                const cypher3 = `MERGE (n:NostrUser {pubkey: '${pubkey_parent}'})-[:FOLLOWS]->(m:NostrUser {pubkey: '${pubkey_child}'}) `
                // const result3 = await write(cypher3, {})
                // console.log(result3)
                aCypherResults.push({cypher3})
              }
            }
          }
        }
      }

      // cleaning up 
      const sql4 = ` UPDATE users SET flaggedToUpdateNeo4jFollows = 0 WHERE pubkey='${pubkey_parent}' `
      const results4 = await connection.query(sql4);
      console.log(results4)
    }

    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/users/updateNeo4jFollows data:`,
      data: { 
        aUsers, aCypherResults, aPubkeysDiscovered
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/users/updateNeo4jFollows error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}