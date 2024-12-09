import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'
import { ResponseData } from '@/types'
import { convertInputToConfidence } from '@/helpers/grapevine' 

/*
Endpoint as per Manime specs

Given an observer and observee, this endpoint returns:
- cypher0: the DoS from the observer to the observee
- all rators of the observee (depending on request), i.e.:
  - cypher1: all followers
  - cypher2: muters of this profile
  - (all reports when available)

TODO: read searchParams.kind which should be an array 
current behaviour: does not read kind; assumes the default that requestor wants kinds 3 and 10000

usage:
observer: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
observee: d6462c102cc630f3f742d7f4871e2f14bdbf563dbc50bc1e83c4ae906c12c62d // 3 hops away
observee: c06885ce21d132b3c29e74aea9f4c171a95b2ed56bafac58a5fbfc9bdc5fbb06 // 3 hops away
observee: 1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b // 2 hops away
observee: cbaa0c829ed322c1551cb6619b4c08b9a26ac97ffb4e959205eec78ee9313245 // 1 hop away

WORKING
https://www.graperank.tech/api/outwardFacing/getDataForOtherProfilePage?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=d6462c102cc630f3f742d7f4871e2f14bdbf563dbc50bc1e83c4ae906c12c62d

WORKING
https://www.graperank.tech/api/outwardFacing/getDataForOtherProfilePage?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=c06885ce21d132b3c29e74aea9f4c171a95b2ed56bafac58a5fbfc9bdc5fbb06

WORKING
https://www.graperank.tech/api/outwardFacing/getDataForOtherProfilePage?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b

WORKING
https://www.graperank.tech/api/outwardFacing/getDataForOtherProfilePage?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=cbaa0c829ed322c1551cb6619b4c08b9a26ac97ffb4e959205eec78ee9313245

WORKING:
https://www.graperank.tech/api/outwardFacing/getDataForOtherProfilePage?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&observee=32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245

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
      message: `api/outwardFacing/getDataForOtherProfilePage: no observer was provided`
    }
    res.status(500).json(response)
  }
  if (!searchParams.observee) {
    const response:ResponseData = {
      success: false,
      message: `api/outwardFacing/getDataForOtherProfilePage: no observee was provided`
    }
    res.status(500).json(response)
  }
  const observer = searchParams.observer
  const observee = searchParams.observee  
  let kinds = [3, 10000] // TODO: read kinds from searchParams
  if (typeof searchParams.kinds == 'string') {
    const sKinds = searchParams.kinds
    kinds = JSON.parse(sKinds)
  }
  if (typeof observer == 'string' && verifyPubkeyValidity(observer) && typeof observee == 'string' && verifyPubkeyValidity(observee)) {
    const cypher0 = `MATCH p = SHORTEST 1 (n:NostrUser)-[:FOLLOWS]->+(m:NostrUser)
    WHERE n.pubkey='${observer}' AND m.pubkey='${observee}'
    RETURN length(p) as dos` 

    const cypher1 = `MATCH (n:NostrUser {pubkey: '${observee}'})<-[:FOLLOWS]-(m:NostrUser) ORDER BY m.pagerank DESC RETURN m `
    const cypher2 = `MATCH (n:NostrUser {pubkey: '${observee}'})<-[:MUTES]-(m:NostrUser) ORDER BY m.pagerank DESC RETURN m `
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
      const dos = aResults[0].dos.low

      // KIND 3: FOLLOWERS
      const aFollowerPubkeys = []
      if (kinds.includes(3)) {
        const result1 = await read(cypher1, {})
        const aFollowers = JSON.parse(JSON.stringify(result1))
        for (let x=0; x < Math.min(aFollowers.length,1000); x++) {
          const oNextUserData = aFollowers[x]
          const pk = oNextUserData.m.properties.pubkey
          const pagerank = oNextUserData.m.properties.pagerank
          const cypherDos = `MATCH p = SHORTEST 1 (n:NostrUser)-[:FOLLOWS]->+(m:NostrUser)
          WHERE n.pubkey='${observer}' AND m.pubkey='${pk}'
          RETURN length(p) as numHops` 
          const result_cypherDos = await read(cypherDos, {})
          const aResults = JSON.parse(JSON.stringify(result_cypherDos))
          let numHops = 999
          if (aResults[0] && aResults[0].numHops) { 
            numHops = aResults[0].numHops.low
          }
          
          // GrapeRank: set defaults to zero
          let average = 0
          let input = 0.05 // 
          // estimate grapeRank by DoS
          if (numHops < 100) {
            average = 1
            input = 0.05 * (1 / numHops + 1)
          }
          const confidence = convertInputToConfidence(input, rigor)
          const influence = Number((average * confidence).toFixed(4))

          const oFollowerData = {rator: pk, dos: numHops, pagerank, grapeRank_dos: {influence, confidence, average, input}}
          aFollowerPubkeys.push(oFollowerData)

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
        for (let x=0; x < Math.min(aMuters.length, 2000); x++) {
          const oNextUserData = aMuters[x]
          const pk = oNextUserData.m.properties.pubkey
          const pagerank = oNextUserData.m.properties.pagerank
          const cypherDos = `MATCH p = SHORTEST 1 (n:NostrUser)-[:MUTES]->+(m:NostrUser)
          WHERE n.pubkey='${observer}' AND m.pubkey='${pk}'
          RETURN length(p) as numHops` 
          const result_cypherDos = await read(cypherDos, {})
          const aResults = JSON.parse(JSON.stringify(result_cypherDos))
          let numHops = 999
          if (aResults[0] && aResults[0].numHops) { 
            numHops = aResults[0].numHops.low
          }
          const oRating = {rator: pk, dos: numHops, pagerank, timestamp: 0}
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
        message: `api/outwardFacing/getDataForOtherProfilePage data:`,
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
          ratee: observee, dos: dos, 
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
        message: `api/outwardFacing/getDataForOtherProfilePage error: ${error}`,
        data: {
          observer,
          cypher0,
          cypher1,
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/outwardFacing/getDataForOtherProfilePage: the provided observer and / or observee pubkey is invalid`,
      data: {
        observer, observee
      }
    }
    res.status(500).json(response)
  }
}