import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { validateEvent } from 'nostr-tools'
import mysql from 'mysql2/promise'
import { isValidPubkey } from '@/helpers/nip19'
import { read } from '@/lib/neo4j'

/*
- sql0: select * from users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0 LIMIT ${numUsersToProcess}
  (flaggedToUpdateNeo4jNode=0 so we wait until parent node is properly updated)
for each row:
  - get const pubkey_parent, const kind3EventId
  - cypher0: calculate aCurrentFollows
  - s3_1: get kind3Event using kind3EventId
  - from kind3Event, calculate aFutureFollows
  - from aFutureFollows and aCurrentFollows, calculate: aFollowsToRemove and aFollowsToAdd (in theory, should usually be just one change)
  -* cypher1: add node for pubkey_parent if does not already exist (although in theory, it should already exist)
  - for each pk in aFollowsToAdd:
    - get const pubkey_child
    -* cypher1: add node for pubkey_child if does not already exist
    -* cypher2: add edge FOLLOWS from pubkey_parent to pubkey_child; include timestamp!
    - ???? sql1a_pre: INSERT IGNORE pubkey='${pubkey_child}' (TODO: need to add pubkey_child to sql table users if not already present ???) (maybe avoid since this will trigger AUTO_INCREMENT and row ought to be present already??)
    -* sql1a: UPDATE users SET flaggedToUpdateReverseObserveeObject=1 WHERE pubkey='${pubkey_child}'
  - for each pk in aFollowsToRemove:
    - get const pubkey_child
    -* cypher3: remove edge FOLLOWS from pubkey_parent to pubkey_child
    -* sql1b: UPDATE users SET flaggedToUpdateReverseObserveeObject=1 WHERE pubkey='${pubkey_child}'

  // cleaning up
  -* sqlc: UPDATE users SET flaggedToUpdateNeo4jFollows = 0 WHERE pubkey=pubkey_parent

usage:

https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollowsAndFlagToUpRevObObj?n=1

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
    const sql0 = ` SELECT * FROM users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0 LIMIT ${numUsersToProcess}`
    const results0 = await connection.query(sql0);
    const aUsers = JSON.parse(JSON.stringify(results0[0]))
    const aCypherResults = []
    for (let x=0; x < aUsers.length; x++) {
      const oNextUser = aUsers[x]
      // get const pubkey_parent, const kind3EventId
      const pubkey_parent = oNextUser.pubkey
      const kind3EventId = oNextUser.kind3EventId

      // cypher0: calculate aCurrentFollows
      const cypher0 = `MATCH (n:NostrUser {pubkey: '${pubkey_parent}'})-[:FOLLOWS]->(m:NostrUser) RETURN m ` // cypher command 
      const result0 = await read(cypher0, {})
      const aCurrentFollows = []
      const aCurrentFollowsData = JSON.parse(JSON.stringify(result0))
      for (let x=0; x < aCurrentFollowsData.length; x++) {
        const oNextUserData = aCurrentFollowsData[x]
        const pk = oNextUserData.m.properties.pubkey
        aCurrentFollows.push(pk)
      }

      // s3_1: get kind3Event using kind3EventId
      const params = {
        Bucket: 'grapevine-nostr-cache-bucket',
        Key: 'eventsByEventId/' + kind3EventId,
      }
      const command = new GetObjectCommand(params);
      const data = await client.send(command);
      const sKind3Event = await data.Body?.transformToString()

      let oKind3Event = {}
      if (typeof sKind3Event == 'string') {
        oKind3Event = JSON.parse(sKind3Event) 
      }

      let created_at_newFollows = 0
      // from kind3Event, calculate aFutureFollows
      const aFutureFollows = []
      if (validateEvent(oKind3Event)) {
        created_at_newFollows = oKind3Event.created_at
        const aTags = oKind3Event.tags
        for (let t=0; t < aTags.length; t++) {
          const aTag = aTags[t]
          if (aTag && aTag[0] == 'p' && aTag[1] && isValidPubkey(aTag[1])) {
            const pubkey_child = aTag[1]
            aFutureFollows.push(pubkey_child)
          }
        }
      }

      // from aFutureFollows and aCurrentFollows, calculate: aFollowsToRemove and aFollowsToAdd (in theory, should usually be just one change)
      const aFollowsToAdd:string[] = [] // in aFutureFollows but not in aCurrentFollows
      for (let z=0; z<aFutureFollows.length; z++) {
        const pk = aFutureFollows[z]
        if (!aCurrentFollows.includes(pk)) {
          aFollowsToAdd.push(pk)
        }
      }
      const aFollowsToRemove:string[] = [] // in aCurrentFollows but not in aFutureFollows
      for (let z=0; z<aCurrentFollows.length; z++) {
        const pk = aCurrentFollows[z]
        if (!aFutureFollows.includes(pk)) {
          aFollowsToRemove.push(pk)
        }
      }

      aCypherResults.push({pubkey_parent, created_at_newFollows, kind3EventId, oKind3Event, aCurrentFollows, aFutureFollows, aFollowsToAdd, aFollowsToRemove})
/*
      // cypher1: add node for pubkey_parent if does not already exist (although in theory, it should already exist)
      const cypher1 = `MERGE (n:NostrUser {pubkey: '${pubkey_parent}'}) RETURN n.pubkey AS pubkey `
      const cypher1_results = await write(cypher1, {})
      console.log(typeof cypher1_results)
      // aCypherResults.push({cypher0, cypher1_results})

      for (let z=0; z<aFollowsToAdd.length; z++) {
        // get const pubkey_child
        const pubkey_child = aFollowsToAdd[z]
        // cypher1: add node for pubkey_child if does not already exist
        const cypher1 = `MERGE (n:NostrUser {pubkey: '${pubkey_child}'}) RETURN n.pubkey AS pubkey `
        const cypher1_results = await write(cypher1, {})
        console.log(typeof cypher1_results)
        // aCypherResults.push({cypher1, cypher1_results})

        // cypher2: add edge FOLLOWS from pubkey_parent to pubkey_child; include timestamp!
        const cypher2 = `MATCH (n:NostrUser {pubkey: '${pubkey_parent}'}), (m:NostrUser {pubkey: '${pubkey_child}'}) MERGE (n)-[r:FOLLOWS]->(m) SET r.timestamp=${created_at_newFollows} `
        const cypher2_results = await write(cypher2, {})
        console.log(typeof cypher2_results)
        // aCypherResults.push({cypher2, cypher2_results})

        // ???? sql1a_pre: INSERT IGNORE pubkey='${pubkey_child}' (TODO: need to add pubkey_child to sql table users if not already present ???) (maybe avoid since this will trigger AUTO_INCREMENT and row ought to be present already??)
        // sql1a: UPDATE users SET flaggedToUpdateReverseObserveeObject=1 WHERE pubkey='${pubkey_child}'
        const sqla = ` UPDATE users SET flaggedToUpdateReverseObserveeObject=1 WHERE pubkey='${pubkey_child}' `
        const sqla_results = await connection.query(sqla);
        console.log(typeof sqla_results)
      }

      for (let z=0; z<aFollowsToRemove.length; z++) {
        // get const pubkey_child
        const pubkey_child = aFollowsToRemove[z]

        // cypher3: remove edge FOLLOWS from pubkey_parent to pubkey_child
        const cypher3 = `MATCH (n:NostrUser {pubkey: '${pubkey_parent}'})-[:FOLLOWS]->(m:NostrUser {pubkey: '${pubkey_child}'}) DELETE r `
        const cypher3_results = await write(cypher3, {})
        console.log(typeof cypher3_results)
        // aCypherResults.push({cypher3, cypher3_results})

        // sql1b: UPDATE users SET flaggedToUpdateReverseObserveeObject=1 WHERE pubkey='${pubkey_child}'
        const sqlb = ` UPDATE users SET flaggedToUpdateReverseObserveeObject=1 WHERE pubkey='${pubkey_child}' `
        const sqlb_results = await connection.query(sqlb);
        console.log(typeof sqlb_results)
      }

      // cleaning up; sqlc: UPDATE users SET flaggedToUpdateNeo4jFollows = 0 WHERE pubkey=pubkey_parent
      const sqlc = ` UPDATE users SET flaggedToUpdateNeo4jFollows = 0 WHERE pubkey='${pubkey_parent}' `
      const sqlc_results = await connection.query(sqlc);
      console.log(sqlc_results)
*/
    }
    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)
    
    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/users/updateNeo4jFollowsAndFlagToUpRevObObj data:`,
      data: { 
        numUsers: aUsers.length,
        aCypherResults,
      }
    }
    res.status(200).json(response)

  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/users/updateNeo4jFollowsAndFlagToUpRevObObj error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}