import { UserCircleIcon } from '@heroicons/react/solid'
import toast, { Toaster } from 'react-hot-toast';
import { MediaRenderer, useContract, useListing,
    useNetwork,
    useNetworkMismatch,
    useMakeBid,
    useOffers,
    useMakeOffer,
    useBuyNow,
    useAddress,
    useAcceptDirectListingOffer
} from '@thirdweb-dev/react'
import { ListingType, NATIVE_TOKENS } from '@thirdweb-dev/sdk'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import Header from '../../components/Header'
import Countdown from 'react-countdown'
import network from '../../utils/network'
import { Context } from 'wagmi'
import { ethers } from 'ethers'

type Props = {}
    
function ListingPage({}: Props) {
    const router = useRouter()
    const {listingId} = router.query as {listingId: string}
    const [ bidAmount, setBidAmount] = useState('')
    const address = useAddress()
    const [, switchNetwork] = useNetwork()
    const networkMismatch = useNetworkMismatch()
    const [minimunNextBid, setMinimumNextBid] = useState<{
        displayValue: string;
        symbol: string;
    }>()

    const {contract} = useContract(
        process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT, 'marketplace'
    )

    const {mutate: buyNow} = useBuyNow(contract)

    const {
        mutate: makeOffer
      } = useMakeOffer(contract);

    const {data: offers} = useOffers(contract, listingId);

    const {mutate: makeBid} = useMakeBid(contract);

    const { data: listing, isLoading, error} = useListing(contract, listingId)

    useEffect(() => {
        if(!listingId || !contract || !listing) return

        if(listing.type === ListingType.Auction){
            fetchMinNextBid();
        }
    }, [listingId, listing, contract])

    const fetchMinNextBid = async () => {
        if(!listingId || !contract) return

        const {displayValue, symbol} = await contract.auction.getMinimumNextBid(listingId)

        setMinimumNextBid({
            displayValue: displayValue,
            symbol: symbol
        })
    }

    const formatPlaceholder = () => {
        if(!listing) return
        if(listing.type === ListingType.Direct){
            return 'Enter Offer Amount'
        }

        if(listing.type === ListingType.Auction){
            return Number(minimunNextBid?.displayValue) === 0 ?
            'Enter Bid Amount' : `${minimunNextBid?.displayValue} ${minimunNextBid?.symbol} or more`
        }
    }

    const {mutate: acceptOffer} = useAcceptDirectListingOffer(contract);

    const buyNft = async () => {
        if(networkMismatch){
            switchNetwork && switchNetwork(network)
            return
        }
        if(!listingId || !contract || !listing) return
        await buyNow({
            id: listingId,
            buyAmount: 1,
            type: listing?.type,
        }, {
            onSuccess(data, variables, context) {
                toast.success('Item was purchased successfully!')
                console.log('SUCCESS', data)
                router.replace('/')
            },
            onError(error, variables, context) {
                toast.error('NFT could not be bought!')
                console.log("ERROR", error, variables, context)
            },
        })
    }

    const createBidorOffer = async () => {
        try {
            if(networkMismatch){
                switchNetwork && switchNetwork(network)
                return
            }

            //direct listing
            if(listing?.type === ListingType.Direct){
                if(listing.buyoutPrice.toString() === ethers.utils.parseEther(bidAmount).toString()){
                    buyNft();
                    return
                }
                toast.loading("Buyout price not met, making offer...!")
                await makeOffer({
                    quantity: 1,
                    listingId,
                    pricePerToken: bidAmount,
                }, {
                    onSuccess(data, variables, context) {
                        toast.success('Offer was made successfully!')
                        setBidAmount('')
                    },
                    onError(error, variables, context) {
                        toast.error("Offer could not be made!")
                    },
                }
                )
            }
            //auction listing
            if(listing?.type === ListingType.Auction){
                console.log('making bid ....')
                await makeBid({
                    listingId,
                    bid: bidAmount,
                }, {
                    onSuccess(data, variables, context) {
                        toast.success('Bid has been made successfully!')
                        setBidAmount('')
                    },
                    onError(error, variables, context) {
                        toast.error('Bid could not be made')
                    },
                })
            }
        } catch (error) {
            console.error(error)
        }
    }

    if(isLoading){
        return <div>
            <Header/>
            <div className='text-center animate-pluse text-blue-500'>
                <p>
                    Loading Item...
                </p>
            </div>
        </div>
    }
    if(!listing){
        return <div>Listing not Found</div>
    }

  return (
    <div>
        <Header/>

        <main className='max-w-6xl mx-auto p-2 flex flex-col lg:flex-row space-y-10 space-x-5 pr-10'>
            <div className='p-10 border mx-auto lg:mx-0 max-w-md lg:max-w-xl'>
                <MediaRenderer src={listing.asset.image}/>
            </div>
            <section className='flex-1 space-y-5 pb-20 lg:pb-0'>
                <div>
                    <h1 className='text-xl font-bold'>{listing.asset.name}</h1>
                    <p className='text-gray-600'>{listing.asset.description}</p>
                    <p className='flex items-center text-xs sm:text-base'>
                        <UserCircleIcon className='h-5'/>
                        <span className='font-bold pr-1'>Seller:</span>
                        {listing.sellerAddress}</p>
                        
                </div>
                <div className='grid grid-cols-2 items-center py-2'>
                    <p className='font-bold'>
                        Listing Type:
                    </p>
                    <p>{listing.type === ListingType.Direct ? 'Direct Listing' : 'Auction Listing'}</p>
                    <p className='font-bold'>Buy it now price:</p>
                    <p className='text-4xl font-bold'>{listing.buyoutCurrencyValuePerToken.displayValue} {listing.buyoutCurrencyValuePerToken.symbol}</p>

                    <button onClick={buyNft} className='col-start-2 mt-2 bg-blue-600 font-bold text-white rounded-full py-4 px-10'>Buy Now</button>
                </div>

                {/* if direct, show offers here */}
                {listing.type === ListingType.Direct && offers && (
                    <div className='grid grid-cols-2 gap-y-2'>
                        <p className='font-bold'>Offers:</p>
                        <p className='font-bold'>{offers.length > 0 ? offers.length : 0}</p>

                        {offers.map(offer => (
                            <>
                            <p className='flex items-center ml-5 text-sm italic'>
                                <UserCircleIcon className='h-3 mr-2' />
                                {offer.offerer.slice(0, 5) + "..." + offer.offerer.slice(-5)}
                            </p>
                            <div>
                                <p key={
                                    offer.listingId +
                                    offer.offerer +
                                    offer.totalOfferAmount.toString()
                                } className='text-sm italic'>
                                    {ethers.utils.formatEther(offer.totalOfferAmount)}{" "}
                                    {NATIVE_TOKENS[network].symbol}
                                </p>
                                {listing.sellerAddress === address && (
                                    <button
                                    onClick={() => acceptOffer({
                                        listingId,
                                        addressOfOfferor: offer.offerer
                                    },{
                                        onSuccess(data, variables, context) {
                                            toast.success('offer was accepted successfully!')
                                            router.replace('/')
                                        },
                                        onError(error, variables, context) {
                                            toast.error('Offer could not be accepted!')
                                        },
                                    })}
                                    className='p-2 bg-red-500/50 rounded-lg font-bold text-sm cursor-pointer'
                                    >
                                        Accept Offer
                                    </button>
                                )}
                            </div>
                            </>
                        ))}
                    </div>
                )}
                <div className='grid grid-cols-2 space-y-2 items-center justify-end'>
                    <hr className='col-span-2' />
                    <p className='col-span-2 font-bold'>{listing.type === ListingType.Direct ? 'Make an Offer' : 'Bid on this Auction'}</p>

                    {/* remaining time on aution goes here */}
                    {listing.type === ListingType.Auction && (
                        <>
                            <p>Current Minimun Bid:</p>
                            <p className='font-bold'>{minimunNextBid?.displayValue} {minimunNextBid?.symbol}</p>
                            <p>Time Remaining:</p>
                            <Countdown date={Number(listing.endTimeInEpochSeconds.toString()) * 1000} />
                        </>
                    )}
                    <input onChange={e => setBidAmount(e.target.value)} className='border p-2 rounded-lg mr-5' type="text" placeholder={formatPlaceholder()} />
                    <button onClick={createBidorOffer} className='bg-red-600 font-bold text-white rounded-full py-4 px-10'>{listing.type === ListingType.Direct ? 'Offer' : 'Bid'}</button>
                </div>
            </section>
        </main>
    </div>
  )
}

export default ListingPage