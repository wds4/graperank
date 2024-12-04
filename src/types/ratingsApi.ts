export type Pubkey = string
export type kind = number

// minimum 6 characrters containing the first part of a pubkey
// full pubkey MUST be included in the containing dataset to decode PubkeyBreve
// PubkeyBreve MAY include additional caracters from pubkey to avoid duplicates within the dataset
// type PubkeyBreve = string

type RatingData = {
    rator : Pubkey, 
    dos : number,
    timestamp? : number,
    [edgemeta : string] : string | number | undefined
}

// a normalized ratings object returned by ANY request for rattings data
// where EVERY instance of PubkeyBreve is represented by a key (as pubkey)
export type RatingResponse = {
    ratee : Pubkey,
    dos : any
    ratings :  Record<kind,RatingData[]>
}

export type RatingsRequest = {
    observer: Pubkey,
    observee: Pubkey,
    kinds : number[]
}

// Example Response:
const example : RatingResponse = {
    ratee : 'observeepubkey',
    dos: 2,
    ratings: {
        3: [
            {rator : '123', dos : 2, timestamp : 123,},
            {rator : '123', dos : 2, timestamp : 123,},
            {rator : '123', dos : 2, timestamp : 123,}
        ],
        10000: [
            {rator : '123', dos : 2, timestamp : 123,},
            {rator : '123', dos : 2, timestamp : 123,}
        ],
        1981: [
            {rator : '123', dos : 2, timestamp : 123, type : 'nudity'},
            {rator : '123', dos : 2, timestamp : 123, type : 'language'}
        ],    
    }
}



// export type EntireNetwork = AllPubkeysNHopsAway[]

/*
// example: 
const allPubkeysNHopsAway:AllPubkeysNHopsAway = {
    0: [
        {
            pubkey: <Pubkey>,
            folllowedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            mutedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            reportedBy: {
                nudity: [<abbrPubkey1>, <abbrPubkey2> ...],
                malware: [<abbrPubkey1>, <abbrPubkey2> ...],
                profanity: [<abbrPubkey1>, <abbrPubkey2> ...],
                illegal: [<abbrPubkey1>, <abbrPubkey2> ...],
                spam: [<abbrPubkey1>, <abbrPubkey2> ...],
                impersonation: [<abbrPubkey1>, <abbrPubkey2> ...],
                other: [<abbrPubkey1>, <abbrPubkey2> ...],
            }
        },
        {
            pubkey: <Pubkey>,
            folllowedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            mutedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            reportedBy: {
                nudity: [<abbrPubkey1>, <abbrPubkey2> ...],
                malware: [<abbrPubkey1>, <abbrPubkey2> ...],
                profanity: [<abbrPubkey1>, <abbrPubkey2> ...],
                illegal: [<abbrPubkey1>, <abbrPubkey2> ...],
                spam: [<abbrPubkey1>, <abbrPubkey2> ...],
                impersonation: [<abbrPubkey1>, <abbrPubkey2> ...],
                other: [<abbrPubkey1>, <abbrPubkey2> ...],
            }
        }
    ].
    1: {
        
            abbreviation: <abbrPubkey>,
            folllowedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            mutedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            reportedBy: {
                nudity: [<abbrPubkey1>, <abbrPubkey2> ...],
                malware: [<abbrPubkey1>, <abbrPubkey2> ...],
                profanity: [<abbrPubkey1>, <abbrPubkey2> ...],
                illegal: [<abbrPubkey1>, <abbrPubkey2> ...],
                spam: [<abbrPubkey1>, <abbrPubkey2> ...],
                impersonation: [<abbrPubkey1>, <abbrPubkey2> ...],
                other: [<abbrPubkey1>, <abbrPubkey2> ...],
            }
        },
        <pubkey2>: {
            abbreviation: <abbrPubkey>,
            folllowedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            mutedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            reportedBy: {
                nudity: [<abbrPubkey1>, <abbrPubkey2> ...],
                malware: [<abbrPubkey1>, <abbrPubkey2> ...],
                profanity: [<abbrPubkey1>, <abbrPubkey2> ...],
                illegal: [<abbrPubkey1>, <abbrPubkey2> ...],
                spam: [<abbrPubkey1>, <abbrPubkey2> ...],
                impersonation: [<abbrPubkey1>, <abbrPubkey2> ...],
                other: [<abbrPubkey1>, <abbrPubkey2> ...],
            }
        }
    },
    ...
}
*/
