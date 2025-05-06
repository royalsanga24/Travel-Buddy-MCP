import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Amadeus from "amadeus";
import 'dotenv/config';
import fs from 'fs';

// Initialize Amadeus API client (register at developers.amadeus.com for ID/SECRET)
const amadeus = new Amadeus({
  clientId: "your_client_id",
  clientSecret: "your_client_secret"
});

// Create the MCP server
const server = new McpServer({ name: "TravelTools", version: "1.0.0" });

// Tool: search flights between origin and destination
server.tool(
  "search_flights",
  {
    origin: z.string(),
    destination: z.string(),
    departureDate: z.string(),
    returnDate: z.string().optional(),
    adults: z.number().default(1)
  },
  async ({ origin, destination, departureDate, returnDate, adults }) => {
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
);

// Tool: search hotels in a city
server.tool(
  "search_hotels",
  {
    location: z.string().describe("City code (e.g., NYC, PAR, LON)"), 
    checkIn: z.string(),
    checkOut: z.string(),
    adults: z.number().default(1)
  },
  async ({ location, checkIn, checkOut, adults }) => {
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
      return {
        content: [{ type: "text", text: errorMessage }]
      };
    }
  }
);

// Start the server on stdin/stdout (so Claude can connect via stdio)
const transport = new StdioServerTransport();
server.connect(transport);