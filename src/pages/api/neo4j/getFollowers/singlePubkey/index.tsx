import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'
import { ResponseData } from '@/types'

/*
usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/neo4j/getFollowers/singlePubkey?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

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
      message: `api/neo4j/getFollowers/singlePubkey: no pubkey was provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      const cypher1 = `MATCH (n:NostrUser {pubkey: '${pubkey1}'})<-[:FOLLOWS]-(m:NostrUser) RETURN m ` // cypher command 
      try {
        const result1 = await read(cypher1, {})
        console.log(result1)
        const aPubkeys = []
        const aUsers = JSON.parse(JSON.stringify(result1))
        for (let x=0; x < aUsers.length; x++) {
          const oNextUserData = aUsers[x]
          const pk = oNextUserData.m.properties.pubkey
          aPubkeys.push(pk)
        }

        const response:ResponseData = {
          success: true,
          exists: true,
          message: `api/neo4j/getFollowers/singlePubkey data:`,
          data: {
            cypher: cypher1, numFollowers: aPubkeys.length, aPubkeys,
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/neo4j/getFollowers/singlePubkey error: ${error}`,
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
        message: `api/neo4j/getFollowers/singlePubkey: the provided pubkey is invalid`,
        data: {
          pubkey1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/neo4j/getFollowers/singlePubkey: no pubkey was provided`
    }
    res.status(500).json(response)
  }
}