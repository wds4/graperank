import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'
import { ResponseData } from '@/types'

/*
Given a pubkey, return:
- that pubkey's followers via neo4j
- for each follower:
  - DoS
  - GrapeRank scorecard

usage:
observer: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/neo4j/returnDataForSelfProfilePage?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
*/
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  if (searchParams.npub) {
    // TODO: support npub
  }
  if (!searchParams.observer) {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getRatorsWithDos: no observer was provided`
    }
    res.status(500).json(response)
  }
  const observer = searchParams.observer

  if (typeof observer == 'string' && verifyPubkeyValidity(observer)) {
    // get my followers
    const cypher1 = `MATCH (n:NostrUser {pubkey: '${observer}'})<-[:FOLLOWS]-(m:NostrUser) RETURN m `
    // get my follows
    const cypher2 = `MATCH (n:NostrUser {pubkey: '${observer}'})-[:FOLLOWS]->(m:NostrUser) RETURN m `
    try {
      // FOLLOWS
      const aFollowPubkeys = []
      const result2 = await read(cypher2, {})
      const aFollows = JSON.parse(JSON.stringify(result2))

      // FOLLOWERS
      const aFollowersWithScores = []
      const result1 = await read(cypher1, {})
      const aFollowers = JSON.parse(JSON.stringify(result1))

      for (let x=0; x < aFollowers.length; x++) {
        const oNextUserData = aFollowers[x]
        const pk = oNextUserData.m.properties.pubkey
        const cypherDos = `MATCH p = SHORTEST 1 (n:NostrUser)-[:FOLLOWS]->+(m:NostrUser)
        WHERE n.pubkey='${observer}' AND m.pubkey='${pk}'
        RETURN p, length(p) as numHops` 
        const result_cypherDos = await read(cypherDos, {})
        const aResults = JSON.parse(JSON.stringify(result_cypherDos))
        const dos = aResults[0].numHops.low
        const amIFollowing = false
        // if (aFollows.contains(pk)) {
          // amIFollowing = true
        // }
        const oFollowerData = [ pk, dos, amIFollowing ]
        aFollowersWithScores.push(oFollowerData)
      }

      const response:ResponseData = {
        success: true,
        exists: true,
        message: `api/neo4j/getRatorsWithDos data:`,
        metaData: {
          numFollows: aFollowPubkeys.length,
          numFollowers: aFollowersWithScores.length,
        },
        data: {
          aFollowersWithScores, aFollows,
          cypher1, cypher2, 
        }
      }
      res.status(200).json(response)
    } catch (error) {
      const response = {
        success: false,
        message: `api/neo4j/getRatorsWithDos error: ${error}`,
        data: {
          observer,
          cypher1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getRatorsWithDos: the provided observer pubkey is invalid`,
      data: {
        observer
      }
    }
    res.status(500).json(response)
  }
}