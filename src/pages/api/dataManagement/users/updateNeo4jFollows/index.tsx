import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { validateEvent } from 'nostr-tools'
import { NostrEvent } from "@nostr-dev-kit/ndk"
import mysql from 'mysql2/promise'
import { isValidPubkey } from '@/helpers/nip19'
import { write } from '@/lib/neo4j'

/*
- select * from users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0 (wait until parent node is properly updated)
for each row:
  - get const pubkey_parent, const kind3EventId
  - cypher1: add node for pubkey_parent if does not already exist
  - cypher2: remove all FOLLOWS edges starting at pubkey_parent
  - s3_1: get kind3Event using kind3EventId
  - cycle through each pubkey_child in kind3Event:
    - const pubkey_child
    - cypher3: add node for pubkey_child if does not already exist
    (TODO: need to add pubkey_child to sql table users if not already present ???)
    - cypher4: add edge FOLLOWS from pubkey_parent to pubkey_child
  // cleaning up
  - sql2: UPDATE users SET flaggedToUpdateNeo4jFollows = 0 WHERE pubkey=pubkey_parent

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
    const sql1 = ` SELECT * FROM users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0 `
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
      const cypher1_results = await write(cypher1, {})
      // console.log(cypher1_results)
      aCypherResults.push({cypher1, cypher1_results})
      
      // cypher2: remove all FOLLOWS edges starting at pubkey_parent
      const cypher2 = ` MATCH (n:NostrUser {pubkey: '${pubkey_parent}'})-[f:FOLLOWS]->() 
      DELETE f `
      const cypher2_results = await write(cypher2, {})
      console.log(cypher2_results)
      aCypherResults.push({cypher2})

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

                // cypher3: add node pubkey_child if not already exists
                const cypher3 = `MERGE (n:NostrUser {pubkey: '${pubkey_child}'}) RETURN n.pubkey AS pubkey `
                const cypher3_results = await write(cypher3, {})
                // console.log(cypher3_results)
                aCypherResults.push({cypher3, cypher3_results})

                // cypher4: add edge FOLLOWS from pubkey_parent to pubkey_child
                const cypher4 = `MATCH (n:NostrUser {pubkey: '${pubkey_parent}'}), (m:NostrUser {pubkey: '${pubkey_child}'}) MERGE (n)-[:FOLLOWS]->(m)`
                const cypher4_results = await write(cypher4, {})
                // console.log(cypher4_results)
                aCypherResults.push({cypher4, cypher4_results})
              }
            }
          }
        }
      }

      // cleaning up 
      const sql2 = ` UPDATE users SET flaggedToUpdateNeo4jFollows = 0 WHERE pubkey='${pubkey_parent}' `
      const sql2_results = await connection.query(sql2);
      console.log(sql2_results)
    }

    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/users/updateNeo4jFollows data:`,
      data: { 
        aUsers, aPubkeysDiscovered
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