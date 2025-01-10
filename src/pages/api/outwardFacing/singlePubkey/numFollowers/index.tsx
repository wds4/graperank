import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { read } from '@/lib/neo4j'
import { ResponseData } from '@/types'

/*
usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/outwardFacing/singlePubkey/numFollowers?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

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
      message: `api/outwardFacing/singlePubkey/numFollowers: no pubkey was provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      const cypher1 = `MATCH (n:NostrUser {pubkey: '${pubkey1}'})<-[:FOLLOWS]-(m:NostrUser) RETURN count(m) as numFollowers ` // cypher command 
      try {
        const result1  = await read(cypher1, {})
        const aResult1 = JSON.parse(JSON.stringify(result1))
        const numFollowers = aResult1[0].numFollowers.low
        const response:ResponseData = {
          success: true,
          exists: true,
          message: `api/outwardFacing/singlePubkey/numFollowers data:`,
          data: {
            numFollowers, pubkey1, cypher1, result1
          }
        }
        res.status(200).json(response)
      } catch (error) {
        const response = {
          success: false,
          message: `api/outwardFacing/singlePubkey/numFollowers error: ${error}`,
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
        message: `api/outwardFacing/singlePubkey/numFollowers: the provided pubkey is invalid`,
        data: {
          pubkey1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/outwardFacing/singlePubkey/numFollowers: no pubkey was provided`
    }
    res.status(500).json(response)
  }
}