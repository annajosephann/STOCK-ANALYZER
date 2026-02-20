import { NextResponse } from 'next/server';

export const STOCKS = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries", sector: "Energy" },
  { symbol: "INFY.NS", name: "Infosys", sector: "IT" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", sector: "IT" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", sector: "Banking" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank", sector: "Banking" },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel", sector: "Telecom" },
  { symbol: "ITC.NS", name: "ITC Limited", sector: "FMCG" },
  { symbol: "SBIN.NS", name: "State Bank of India", sector: "Banking" },
  { symbol: "LT.NS", name: "Larsen & Toubro", sector: "Infrastructure" },
  { symbol: "WIPRO.NS", name: "Wipro", sector: "IT" },
  { symbol: "AXISBANK.NS", name: "Axis Bank", sector: "Banking" },
  { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank", sector: "Banking" },
  { symbol: "MARUTI.NS", name: "Maruti Suzuki", sector: "Automobile" },
  { symbol: "TATAMOTORS.NS", name: "Tata Motors", sector: "Automobile" },
  { symbol: "SUNPHARMA.NS", name: "Sun Pharma", sector: "Pharma" },
  { symbol: "ADANIENT.NS", name: "Adani Enterprises", sector: "Conglomerate" },
  { symbol: "NTPC.NS", name: "NTPC", sector: "Power" },
  { symbol: "POWERGRID.NS", name: "Power Grid Corp", sector: "Power" },
  { symbol: "TATASTEEL.NS", name: "Tata Steel", sector: "Metals" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever", sector: "FMCG" }
];

export async function GET() {
  return NextResponse.json({ stocks: STOCKS });
}
