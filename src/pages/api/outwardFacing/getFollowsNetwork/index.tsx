import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { ResponseData } from '@/types'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

/*
TODO: error handling (if data not present)

Given an observer, this endpoint returns the follows network, if it has been calculated and stored in s3:
customerData/<pubkey>/dos.

If not, return exists: false (AND TRIGGER CALCULATION??)

usage:

https://www.graperank.tech/api/outwardFacing/getFollowsNetwork?observer=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

*/
 
const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

const getFollowsNetworkIfAvailable = async (observer:string) => {
  try {
    const params_get3 = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Key: `customerData/${observer}/dos`,
    }

    const command_get3 = new GetObjectCommand(params_get3);
    const response_get3 = await client.send(command_get3);
    const sFollowsNetwork = await response_get3.Body?.transformToString()

    return sFollowsNetwork
  } catch (error) {
    console.log(error)
    return false
  }
}

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
      message: `api/outwardFacing/getFollowsNetwork: no observer was provided`
    }
    res.status(500).json(response)
  }
  const observer = searchParams.observer
  if (typeof observer == 'string' && verifyPubkeyValidity(observer)) {
    try {
      const sFollowsNetwork = await getFollowsNetworkIfAvailable(observer)
      let exists = true
      if (!sFollowsNetwork) {
        exists = false
      }
      let oFollowsNetwork = {}
      if (typeof sFollowsNetwork == 'string') {
        oFollowsNetwork = JSON.parse(sFollowsNetwork)
      }
      
      const response:ResponseData = {
        success: true,
        exists,
        message: `api/outwardFacing/getFollowsNetwork data:`,
        data: {
          observer, oFollowsNetwork
        }
      }
      res.status(200).json(response)
    } catch (error) {
      const response = {
        success: false,
        message: `api/outwardFacing/getFollowsNetwork error: ${error}`,
        data: {
          observer,
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/outwardFacing/getFollowsNetwork: the provided observer pubkey is invalid`,
      data: {
        observer
      }
    }
    res.status(500).json(response)
  }
}