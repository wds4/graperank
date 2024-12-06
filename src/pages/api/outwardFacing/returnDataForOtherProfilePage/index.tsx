import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'
import { ResponseData } from '@/types'
import { convertInputToConfidence } from '@/helpers/grapevine' 

/*
provides:
- observee's followers list (verified and unverified)
- DoS and Scorecard for the observee

NOT COMPLETED

(same as Endpoint as per Manime specs plus additional info:
followers

usage:
observer: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
observee: d6462c102cc630f3f742d7f4871e2f14bdbf563dbc50bc1e83c4ae906c12c62d // 3 hops away
https://www.graperank.tech/api/neo4j/returnDataForOtherProfilePage?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=d6462c102cc630f3f742d7f4871e2f14bdbf563dbc50bc1e83c4ae906c12c62d

TODO: revamp all of the below
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
  if (!searchParams.observee) {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getRatorsWithDos: no observee was provided`
    }
    res.status(500).json(response)
  }
  const observer = searchParams.observer
  const observee = searchParams.observee  
  const kinds = [3, 10000] // TODO: read kinds from searchParams
  if (typeof observer == 'string' && verifyPubkeyValidity(observer) && typeof observee == 'string' && verifyPubkeyValidity(observee)) {
    const cypher0 = `MATCH p = SHORTEST 1 (n:NostrUser)-[:FOLLOWS]->+(m:NostrUser)
    WHERE n.pubkey='${observer}' AND m.pubkey='${observee}'
    RETURN p, length(p) as numHops` 

    const cypher1 = `MATCH (n:NostrUser {pubkey: '${observee}'})<-[:FOLLOWS]-(m:NostrUser) RETURN m `
    const cypher2 = `MATCH (n:NostrUser {pubkey: '${observee}'})<-[:MUTES]-(m:NostrUser) RETURN m `
    try {
      const attenuationFactor = 0.8
      const followConfidence = 0.05
      const muteConfidence = 0.1
      const defaultRaterInfluence_0 = 0.05 / (0 + 1)
      const defaultRaterInfluence_1 = 0.05 / (1 + 1)
      const defaultRaterInfluence_2 = 0.05 / (2 + 1)
      const defaultRaterInfluence_3 = 0.05 / (3 + 1)
      const defaultRaterInfluence_4 = 0.05 / (4 + 1)
      const defaultRaterInfluence_5 = 0.05 / (5 + 1)
      const rigor = 0.25
      let weights = 0
      let products = 0

      const result_cypher0 = await read(cypher0, {})
      const aResults = JSON.parse(JSON.stringify(result_cypher0))
      const numHops = aResults[0].numHops.low

      // KIND 3: FOLLOWERS
      const aFollowerPubkeys = []
      if (kinds.includes(3)) {
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
          const numHops = aResults[0].numHops.low
          const oRating = {rator: pk, dos: numHops, timestamp: 0}
          aFollowerPubkeys.push(oRating)
          // GrapeRank calcs
          const score = 1
          const raterInfluence = 0.05 / (numHops + 1)
          const weight = attenuationFactor * raterInfluence * followConfidence
          const product = weight * score
          weights += weight
          products += product
        }
      }

      // KIND 10000: MUTES
      const aMuterPubkeys = []
      if (kinds.includes(10000)) {
        const result2 = await read(cypher2, {})
        const aMuters = JSON.parse(JSON.stringify(result2))
        for (let x=0; x < aMuters.length; x++) {
          const oNextUserData = aMuters[x]
          const pk = oNextUserData.m.properties.pubkey
          const cypherDos = `MATCH p = SHORTEST 1 (n:NostrUser)-[:MUTES]->+(m:NostrUser)
          WHERE n.pubkey='${observer}' AND m.pubkey='${pk}'
          RETURN p, length(p) as numHops` 
          const result_cypherDos = await read(cypherDos, {})
          const aResults = JSON.parse(JSON.stringify(result_cypherDos))
          const numHops = aResults[0].numHops.low
          const oRating = {rator: pk, dos: numHops, timestamp: 0}
          aMuterPubkeys.push(oRating)
          // GrapeRank calcs
          const score = 0
          const raterInfluence = 0.05 / (numHops + 1)
          const weight = attenuationFactor * raterInfluence + muteConfidence
          const product = weight * score
          weights += weight
          products += product
        }
      }

      const average = products / weights 
      const confidence = convertInputToConfidence(weights, rigor)

      const response:ResponseData = {
        success: true,
        exists: true,
        message: `api/neo4j/getRatorsWithDos data:`,
        metaData: {
          numMuters: aMuterPubkeys.length,
          numFollowers: aFollowerPubkeys.length,
          interpretation: {
            attenuationFactor, rigor, followConfidence, muteConfidence,
            defaultRaterInfluence: {
              0: defaultRaterInfluence_0,
              1: defaultRaterInfluence_1,
              2: defaultRaterInfluence_2,
              3: defaultRaterInfluence_3,
              4: defaultRaterInfluence_4,
              5: defaultRaterInfluence_5,
            },
          },
          naiveScorecard: {
            context: 'notSpam', observer, observee,
            average, confidence, weights,
          },
        },
        data: {
          ratee: observee, dos: numHops, 
          ratings: {
            3: aFollowerPubkeys,
            10000: aMuterPubkeys,
          },
          cypher0, cypher1, cypher2, 
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
      message: `api/neo4j/getRatorsWithDos: the provided observer and / or observee pubkey is invalid`,
      data: {
        observer, observee
      }
    }
    res.status(500).json(response)
  }
}