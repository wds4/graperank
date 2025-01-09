import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'
import { ResponseData } from '@/types'

/*
Given two pubkeys, recommender and recommendee, this endpoing returns Follow Recommendations, meaning: pubkeys recommended by the recommender, to the recommendee

calculated as:
mutuals of the recommender
who also follow the recommendee
but whom the recommendee does not already follow

Intersection of recommender mutuals and the recommendee fans

usage:
recommender: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
recommendee: 50809a53fef95904513a840d4082a92b45cd5f1b9e436d9d2b92a89ce091f164 (Tekkadan)
https://www.graperank.tech/api/neo4j/getFollowRecommendations?recommender=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f&recommendee=50809a53fef95904513a840d4082a92b45cd5f1b9e436d9d2b92a89ce091f164


*/
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  if (searchParams.npub) {
    // TODO: support npub
  }
  if ((!searchParams.recommender) || (!searchParams.recommendee)) {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getFollowRecommendations: no recommender and/or recommendee pubkeys were provided`
    }
    res.status(500).json(response)
  }
  if ((searchParams.recommender) && (searchParams.recommendee)) {
    const recommender = searchParams.recommender
    const recommendee = searchParams.recommendee
    if (typeof recommender == 'string' && verifyPubkeyValidity(recommender) && typeof recommendee == 'string' && verifyPubkeyValidity(recommendee)) {
      const cypher_a_0 = `MATCH (n:NostrUser {pubkey: '${recommender}'})-[:FOLLOWS]->(m:NostrUser) RETURN m ` // cypher command 
      const cypher_a_1 = `MATCH (n:NostrUser {pubkey: '${recommender}'})<-[:FOLLOWS]-(m:NostrUser) RETURN m ` // cypher command 

      const cypher_b_0 = `MATCH (n:NostrUser {pubkey: '${recommendee}'})-[:FOLLOWS]->(m:NostrUser) RETURN m ` // cypher command 
      const cypher_b_1 = `MATCH (n:NostrUser {pubkey: '${recommendee}'})<-[:FOLLOWS]-(m:NostrUser) RETURN m ` // cypher command 
      try {
        // calculate recommender mutuals: aMutuals_a
        const result_a_0 = await read(cypher_a_0, {})
        console.log(result_a_0)

        const result_a_1 = await read(cypher_a_1, {})
        console.log(result_a_1)

        const aFollows_a_ = JSON.parse(JSON.stringify(result_a_0))
        const aFollowers_a_ = JSON.parse(JSON.stringify(result_a_1))

        const aFollows_a = []
        const aFollowers_a = []
        const aMutuals_a = []
        const aFans_a = [] // in followers but not in follows
        const aIdols_a = [] // in follows but not in followers

        for (let x=0; x < aFollows_a_.length; x++) {
          const oNextUserData = aFollows_a_[x]
          const pk = oNextUserData.m.properties.pubkey
          aFollows_a.push(pk)
        }
        for (let x=0; x < aFollowers_a_.length; x++) {
          const oNextUserData = aFollowers_a_[x]
          const pk = oNextUserData.m.properties.pubkey
          aFollowers_a.push(pk)
        }

        for (let x=0; x < aFollows_a.length; x++) {
          const pk = aFollows_a[x]
          if (aFollowers_a.includes(pk)) {
            aMutuals_a.push(pk)
          } else {
            aIdols_a.push(pk)
          }
        }

        for (let x=0; x < aFollowers_a.length; x++) {
          const pk = aFollowers_a[x]
          if (!aFollows_a.includes(pk)) {
            aFans_a.push(pk)
          }
        }

        // calculate recommendee fans: aFans_b
        const result_b_0 = await read(cypher_b_0, {})
        console.log(result_b_0)

        const result_b_1 = await read(cypher_b_1, {})
        console.log(result_b_1)

        const aFollows_b_ = JSON.parse(JSON.stringify(result_b_0))
        const aFollowers_b_ = JSON.parse(JSON.stringify(result_b_1))

        const aFollows_b = []
        const aFollowers_b = []
        const aMutuals_b = []
        const aFans_b = [] // in followers but not in follows
        const aIdols_b = [] // in follows but not in followers

        for (let x=0; x < aFollows_b_.length; x++) {
          const oNextUserData = aFollows_b_[x]
          const pk = oNextUserData.m.properties.pubkey
          aFollows_b.push(pk)
        }
        for (let x=0; x < aFollowers_b_.length; x++) {
          const oNextUserData = aFollowers_b_[x]
          const pk = oNextUserData.m.properties.pubkey
          aFollowers_b.push(pk)
        }

        for (let x=0; x < aFollows_b.length; x++) {
          const pk = aFollows_b[x]
          if (aFollowers_b.includes(pk)) {
            aMutuals_b.push(pk)
          } else {
            aIdols_b.push(pk)
          }
        }

        for (let x=0; x < aFollowers_b.length; x++) {
          const pk = aFollowers_b[x]
          if (!aFollows_b.includes(pk)) {
            aFans_b.push(pk)
          }
        }

        // calculate intersection of aMutuals_a and aFans_b
        const aFollowRecommendations = []
        for (let x=0; x < aMutuals_a.length; x++) {
          const pk = aMutuals_a[x]
          if (aFans_b.includes(pk)) {
            aFollowRecommendations.push(pk)
          }
        }

        const response:ResponseData = {
          success: true,
          exists: true,
          message: `api/neo4j/getFollowRecommendations data:`,
          data: {
            recommender,
            recommendee,
            description: 'returns a list of pubkeys which is the intersection of the mutuals of the recommender with the idols of the recommendee, which are presented to the recommendee as a list of recommended follows.',
            numFollowRecommendations: aFollowRecommendations.length,
            aFollowRecommendations,
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/neo4j/getFollowRecommendations error: ${error}`,
          data: {
            recommender,
            recommendee
          }
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/neo4j/getFollowRecommendations: the provided recommender and/or recommendee pubkeys are invalid`,
        data: {
          recommender,
          recommendee
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getFollowRecommendations: no pubkey was provided`
    }
    res.status(500).json(response)
  }
}