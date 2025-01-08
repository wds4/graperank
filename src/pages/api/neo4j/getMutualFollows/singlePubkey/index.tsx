import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'
import { ResponseData } from '@/types'

/*
This returns the intersection of the followers and the follows of the provided pubkey

usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/neo4j/getMutualFollows/singlePubkey?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

50809a53fef95904513a840d4082a92b45cd5f1b9e436d9d2b92a89ce091f164 (Tekkadan)
https://www.graperank.tech/api/neo4j/getMutualFollows/singlePubkey?pubkey=50809a53fef95904513a840d4082a92b45cd5f1b9e436d9d2b92a89ce091f164

*/
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  if (searchParams.npub) {
    // TODO: support npub
  }
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getMutualFollows/singlePubkey: no pubkey was provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      const cypher0 = `MATCH (n:NostrUser {pubkey: '${pubkey1}'})-[:FOLLOWS]->(m:NostrUser) RETURN m ` // cypher command 
      const cypher1 = `MATCH (n:NostrUser {pubkey: '${pubkey1}'})<-[:FOLLOWS]-(m:NostrUser) RETURN m ` // cypher command 
      try {
        const result0 = await read(cypher0, {})
        console.log(result0)

        const result1 = await read(cypher1, {})
        console.log(result1)

        const aPubkeys = []
        const aFollows = JSON.parse(JSON.stringify(result0))
        const aFollowers = JSON.parse(JSON.stringify(result1))
        const aMutuals = []

        for (let x=0; x < aFollows.length; x++) {
          const oNextUserData = aFollows[x]
          const pk = oNextUserData.m.properties.pubkey
          if (aFollowers.includes(pk)) {
            aMutuals.push(pk)
          }
          aPubkeys.push(pk)
        }

        const response:ResponseData = {
          success: true,
          exists: true,
          message: `api/neo4j/getMutualFollows/singlePubkey data:`,
          data: {
            referencePubkey: pubkey1,
            numFollows: aFollows.length,
            numFollowers: aFollowers.length,
            numMutuals: aMutuals.length,
            aFollows,
            aFollowers,
            aMutuals,
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/neo4j/getMutualFollows/singlePubkey error: ${error}`,
          data: {
            pubkey1,
            cypher1
          }
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/neo4j/getMutualFollows/singlePubkey: the provided pubkey is invalid`,
        data: {
          pubkey1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getMutualFollows/singlePubkey: no pubkey was provided`
    }
    res.status(500).json(response)
  }
}