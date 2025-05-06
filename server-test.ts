import Amadeus from "amadeus";
import 'dotenv/config';

// Initialize Amadeus API client (register at developers.amadeus.com for ID/SECRET)
const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET
});

async function searchFlights({ origin, destination, departureDate, returnDate, adults }: { origin: string, destination: string, departureDate: string, returnDate: string | undefined, adults: number }) {
  // Call Amadeus Flight Offers Search API
  const response = await amadeus.shopping.flightOffersSearch.get({
    originLocationCode: origin,
    destinationLocationCode: destination,
    departureDate: departureDate,
    returnDate: returnDate || undefined,
    adults: String(adults),
  });
  // For brevity, just take the first 2 results
  const flights = response.data.slice(0, 2).map((f: any) =>
    `• ${f.itineraries[0].segments[0].departure.at} ${f.itineraries[0].segments[0].carrierCode} 
         – $${f.price.total}`
  ).join("\n");
  return {
    content: [
      {
        type: "text",
        text: `Found ${response.data.length} flight(s). Top options:\n${flights}`
      }
    ]
  };
}

async function searchHotels({ location, checkIn, checkOut, adults }: { location: string, checkIn: string, checkOut: string, adults: number }) {
  try {
    // First find hotels in the city
    const cityCode = location.substring(0, 3).toUpperCase();
    const hotelsResponse = await amadeus.referenceData.locations.hotels.byCity.get({
      cityCode: cityCode
    });

    // If no hotels found, return early
    if (!hotelsResponse.data || hotelsResponse.data.length === 0) {
      return {
        content: [{ type: "text", text: `No hotels found in ${cityCode}.` }]
      };
    }

    // Take first 3 hotels and get offers
    const hotelIds = hotelsResponse.data.slice(0, 3).map((h: any) => h.hotelId).join(",");

    // Now get offers for these hotels
    const offersResponse = await amadeus.shopping.hotelOffersSearch.get({
      hotelIds: hotelIds,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: String(adults),
      roomQuantity: "1"
    });

    let hotelText = "No offers available";
    if (offersResponse.data && Array.isArray(offersResponse.data) && offersResponse.data.length > 0) {
      const hotels = offersResponse.data
        .map((h: any) => {
          const hotelName = h.hotel?.name || 'Unknown Hotel';
          const currency = h.offers?.[0]?.price?.currency || '';
          const price = h.offers?.[0]?.price?.total || 'Price unavailable';
          return `• ${hotelName}: ${currency} ${price}`;
        })
        .join("\n");
      hotelText = `Found hotel offers in ${cityCode}:\n${hotels}`;
    }

    return {
      content: [{ type: "text", text: hotelText }]
    };
  } catch (error) {
    console.error('Hotel search error:', error);

    let errorMessage = "Error searching for hotels";
    // @ts-ignore
    if (error.response && error.response.result && error.response.result.errors) {
      // @ts-ignore
      const apiError = error.response.result.errors[0];
      errorMessage = `API Error (${apiError.code}): ${apiError.title} - ${apiError.detail}`;
      // @ts-ignore
    } else if (error.message) {
      // @ts-ignore
      errorMessage = error.message;
    }

    return {
      content: [{ type: "text", text: errorMessage }]
    };
  }
}

async function main() {
  const resultFlights = await searchFlights({ origin: "LAX", destination: "NYC", departureDate: "2025-05-20", returnDate: "2025-05-25", adults: 1 });
  console.log(resultFlights);
  const resultHotels = await searchHotels({ location: "LAX", checkIn: "2025-05-20", checkOut: "2025-05-25", adults: 1 });
  console.log(resultHotels);
}

main();
