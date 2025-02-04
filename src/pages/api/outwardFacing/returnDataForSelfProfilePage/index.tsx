import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'
import { ResponseData } from '@/types'
import { convertInputToConfidence } from '@/helpers/grapevine' 

/*
Given a pubkey, return:
- that pubkey's followers via neo4j
- for each follower:
  - DoS
  - GrapeRank scorecard

usage:
observer: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/outwardFacing/returnDataForSelfProfilePage?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

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

    const rigor = 0.25

    try {
      // FOLLOWS
      const aFollowPubkeys = []
      const result2 = await read(cypher2, {})
      const aFollows = JSON.parse(JSON.stringify(result2))

      for (let x=0; x < aFollows.length; x++) {
        const oNextUserData = aFollows[x]
        const pk = oNextUserData.m.properties.pubkey
        aFollowPubkeys.push(pk)
      }

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
        // GrapeRank: set defaults to zero
        let average = 0
        let input = 0.05 // 
        // estimate grapeRank by DoS
        if (dos < 100) {
          average = 1
          input = 0.05 * (1 / dos + 1)
        }
        const confidence = convertInputToConfidence(input, rigor)
        const influence = average * confidence
        let amIFollowing = false
        if (aFollowPubkeys.includes(pk)) {
          amIFollowing = true
        }
        const oFollowerData = [ pk, dos, amIFollowing, {influence, average, confidence, input} ]
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
          aFollowersWithScores, aFollowPubkeys,
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