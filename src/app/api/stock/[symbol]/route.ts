import { NextRequest, NextResponse } from 'next/server';

// Technical indicator calculation functions
function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const sum = data.slice(0, period).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    } else {
      const prevEma = result[i - 1] as number;
      result.push((data[i] - prevEma) * multiplier + prevEma);
    }
  }
  return result;
}

function calculateRSI(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    } else {
      const prevRsi = result[i - 1] as number;
      const prevAvgGain = (prevRsi !== null) ? 
        (100 - prevRsi) === 0 ? 0 : (prevRsi / (100 - prevRsi)) * (gains.slice(i - period, i - 1).reduce((a, b) => a + b, 0) / (period - 1)) : 0;
      const currentGain = gains[i - 1];
      const currentLoss = losses[i - 1];
      
      const avgGain = ((prevAvgGain * (period - 1)) + currentGain) / period;
      const avgLoss = ((prevAvgGain !== 0 ? prevAvgGain : 1) * (period - 1) + currentLoss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }
  
  // Simplified RSI calculation
  const rsiResult: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      rsiResult.push(null);
    } else {
      let avgGain = 0;
      let avgLoss = 0;
      
      for (let j = i - period + 1; j <= i; j++) {
        if (j > 0) {
          const change = closes[j] - closes[j - 1];
          if (change > 0) avgGain += change;
          else avgLoss += Math.abs(change);
        }
      }
      
      avgGain /= period;
      avgLoss /= period;
      
      if (avgLoss === 0) {
        rsiResult.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsiResult.push(100 - (100 / (1 + rs)));
      }
    }
  }
  
  return rsiResult;
}

function calculateMACD(closes: number[]): { macd: (number | null)[], signal: (number | null)[], histogram: (number | null)[] } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  
  const macd: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] === null || ema26[i] === null) {
      macd.push(null);
    } else {
      macd.push((ema12[i] as number) - (ema26[i] as number));
    }
  }
  
  // Calculate signal line (9-period EMA of MACD)
  const validMacd = macd.filter(v => v !== null) as number[];
  const signalEma = calculateEMA(validMacd, 9);
  
  const signal: (number | null)[] = [];
  let validIndex = 0;
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null) {
      signal.push(null);
    } else {
      signal.push(signalEma[validIndex] || null);
      validIndex++;
    }
  }
  
  // Calculate histogram
  const histogram: (number | null)[] = [];
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null || signal[i] === null) {
      histogram.push(null);
    } else {
      histogram.push((macd[i] as number) - (signal[i] as number));
    }
  }
  
  return { macd, signal, histogram };
}

function calculateBollingerBands(closes: number[], period: number = 20, stdDev: number = 2): { upper: (number | null)[], middle: (number | null)[], lower: (number | null)[] } {
  const middle = calculateSMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = middle[i] as number;
      const squaredDiffs = slice.map(v => Math.pow(v - mean, 2));
      const std = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }
  
  return { upper, middle, lower };
}

function findSupportResistance(lows: number[], highs: number[]): { support: number[], resistance: number[] } {
  const support: number[] = [];
  const resistance: number[] = [];
  
  // Simple pivot point detection
  for (let i = 2; i < lows.length - 2; i++) {
    // Support: local minimum
    if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && 
        lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
      support.push(lows[i]);
    }
    // Resistance: local maximum
    if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && 
        highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
      resistance.push(highs[i]);
    }
  }
  
  // Return most recent significant levels
  const recentSupport = support.slice(-3).sort((a, b) => b - a);
  const recentResistance = resistance.slice(-3).sort((a, b) => a - b);
  
  return { 
    support: recentSupport.length > 0 ? recentSupport : [lows[lows.length - 1]], 
    resistance: recentResistance.length > 0 ? recentResistance : [highs[highs.length - 1]] 
  };
}

function calculateSignal(data: {
  currentPrice: number;
  ma20: number;
  ma50: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  bollingerUpper: number;
  bollingerLower: number;
}) {
  let buySignals = 0;
  const signals: {
    maCrossover: { signal: string; reason: string };
    rsi: { signal: string; reason: string };
    macd: { signal: string; reason: string };
    bollinger: { signal: string; reason: string };
  } = {
    maCrossover: { signal: 'NEUTRAL', reason: '' },
    rsi: { signal: 'NEUTRAL', reason: '' },
    macd: { signal: 'NEUTRAL', reason: '' },
    bollinger: { signal: 'NEUTRAL', reason: '' }
  };
  
  // MA Crossover (weight: 25%)
  if (data.ma20 > data.ma50) {
    buySignals += 25;
    signals.maCrossover = { signal: 'BUY', reason: 'MA20 is above MA50, indicating uptrend' };
  } else {
    signals.maCrossover = { signal: 'SELL', reason: 'MA20 is below MA50, indicating downtrend' };
  }
  
  // RSI (weight: 25%)
  if (data.rsi < 30) {
    buySignals += 25;
    signals.rsi = { signal: 'BUY', reason: 'RSI is oversold (<30), potential bounce' };
  } else if (data.rsi > 70) {
    signals.rsi = { signal: 'SELL', reason: 'RSI is overbought (>70), potential pullback' };
  } else {
    buySignals += 12.5;
    signals.rsi = { signal: 'NEUTRAL', reason: `RSI is in neutral zone (${data.rsi.toFixed(1)})` };
  }
  
  // MACD (weight: 25%)
  if (data.macd > data.macdSignal) {
    buySignals += 25;
    signals.macd = { signal: 'BUY', reason: 'MACD is above signal line, bullish momentum' };
  } else {
    signals.macd = { signal: 'SELL', reason: 'MACD is below signal line, bearish momentum' };
  }
  
  // Bollinger (weight: 25%)
  if (data.currentPrice < data.bollingerLower) {
    buySignals += 25;
    signals.bollinger = { signal: 'BUY', reason: 'Price below lower band, potential reversal up' };
  } else if (data.currentPrice > data.bollingerUpper) {
    signals.bollinger = { signal: 'SELL', reason: 'Price above upper band, potential reversal down' };
  } else {
    buySignals += 12.5;
    signals.bollinger = { signal: 'NEUTRAL', reason: 'Price is within Bollinger Bands' };
  }
  
  const confidence = Math.round(buySignals);
  
  return {
    confidence,
    signal: buySignals > 50 ? 'BUY' : buySignals < 50 ? 'SELL' : 'HOLD',
    signals
  };
}

function determineMarketSentiment(rsi: number, macdValue: number, priceVsMA20: number): { sentiment: string; score: number } {
  let score = 50; // Start neutral
  
  // RSI contribution (-20 to +20)
  if (rsi < 30) score -= 15;
  else if (rsi < 40) score -= 10;
  else if (rsi > 70) score += 15;
  else if (rsi > 60) score += 10;
  
  // MACD contribution (-15 to +15)
  if (macdValue > 0) score += Math.min(15, Math.abs(macdValue) * 10);
  else score -= Math.min(15, Math.abs(macdValue) * 10);
  
  // Price vs MA20 contribution (-15 to +15)
  score += priceVsMA20;
  
  score = Math.max(0, Math.min(100, score));
  
  let sentiment = 'Neutral';
  if (score >= 80) sentiment = 'Very Bullish';
  else if (score >= 60) sentiment = 'Bullish';
  else if (score >= 40) sentiment = 'Neutral';
  else if (score >= 20) sentiment = 'Bearish';
  else sentiment = 'Very Bearish';
  
  return { sentiment, score };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&range=5d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data for ${symbol}`);
    }
    
    const data = await response.json();
    
    if (!data.chart?.result?.[0]) {
      throw new Error('Invalid data format received');
    }
    
    const result = data.chart.result[0];
    const quote = result.indicators?.quote?.[0];
    const meta = result.meta;
    
    if (!quote || !quote.close) {
      throw new Error('No quote data available');
    }
    
    const timestamps = result.timestamp || [];
    const closes = quote.close.filter((c: number | null) => c !== null) as number[];
    const highs = quote.high.filter((h: number | null) => h !== null) as number[];
    const lows = quote.low.filter((l: number | null) => l !== null) as number[];
    const volumes = quote.volume.filter((v: number | null) => v !== null) as number[];
    const opens = quote.open.filter((o: number | null) => o !== null) as number[];
    
    // Calculate technical indicators
    const ma20 = calculateSMA(closes, 20);
    const ma50 = calculateSMA(closes, 50);
    const ma200 = calculateSMA(closes, 200);
    const rsi = calculateRSI(closes, 14);
    const { macd, signal: macdSignal, histogram } = calculateMACD(closes);
    const { upper: bollingerUpper, middle: bollingerMiddle, lower: bollingerLower } = calculateBollingerBands(closes, 20, 2);
    const { support, resistance } = findSupportResistance(lows, highs);
    
    // Get latest values
    const lastIndex = closes.length - 1;
    const currentPrice = closes[lastIndex];
    const previousClose = closes.length > 1 ? closes[lastIndex - 1] : currentPrice;
    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
    
    const latestMa20 = ma20[lastIndex];
    const latestMa50 = ma50[lastIndex];
    const latestMa200 = ma200[lastIndex];
    const latestRsi = rsi[lastIndex];
    const latestMacd = macd[lastIndex];
    const latestMacdSignal = macdSignal[lastIndex];
    const latestBollingerUpper = bollingerUpper[lastIndex];
    const latestBollingerLower = bollingerLower[lastIndex];
    
    // Calculate price vs MA20 percentage
    const priceVsMA20Percent = latestMa20 ? ((currentPrice - latestMa20) / latestMa20) * 100 : 0;
    
    // Calculate signal and sentiment
    const signalAnalysis = calculateSignal({
      currentPrice,
      ma20: latestMa20 || currentPrice,
      ma50: latestMa50 || currentPrice,
      rsi: latestRsi || 50,
      macd: latestMacd || 0,
      macdSignal: latestMacdSignal || 0,
      bollingerUpper: latestBollingerUpper || currentPrice,
      bollingerLower: latestBollingerLower || currentPrice
    });
    
    const sentiment = determineMarketSentiment(
      latestRsi || 50, 
      latestMacd || 0, 
      priceVsMA20Percent
    );
    
    // Format candlestick data
    const candleData = timestamps.map((ts: number, i: number) => ({
      time: ts,
      open: opens[i],
      high: highs[i],
      low: lows[i],
      close: closes[i]
    })).filter((d: { time: number; open: number; high: number; low: number; close: number }) => 
      d.open !== null && d.high !== null && d.low !== null && d.close !== null
    );
    
    // Format volume data
    const volumeData = timestamps.map((ts: number, i: number) => ({
      time: ts,
      value: volumes[i],
      color: closes[i] >= opens[i] ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
    })).filter((d: { time: number; value: number }) => d.value !== null);
    
    // Format indicator data for charts
    const ma20Data = timestamps.map((ts: number, i: number) => ({
      time: ts,
      value: ma20[i]
    })).filter((d: { time: number; value: number | null }) => d.value !== null);
    
    const ma50Data = timestamps.map((ts: number, i: number) => ({
      time: ts,
      value: ma50[i]
    })).filter((d: { time: number; value: number | null }) => d.value !== null);
    
    const bollingerUpperData = timestamps.map((ts: number, i: number) => ({
      time: ts,
      value: bollingerUpper[i]
    })).filter((d: { time: number; value: number | null }) => d.value !== null);
    
    const bollingerLowerData = timestamps.map((ts: number, i: number) => ({
      time: ts,
      value: bollingerLower[i]
    })).filter((d: { time: number; value: number | null }) => d.value !== null);
    
    const rsiData = timestamps.map((ts: number, i: number) => ({
      time: ts,
      value: rsi[i]
    })).filter((d: { time: number; value: number | null }) => d.value !== null);
    
    const macdData = timestamps.map((ts: number, i: number) => ({
      time: ts,
      value: macd[i]
    })).filter((d: { time: number; value: number | null }) => d.value !== null);
    
    const macdSignalData = timestamps.map((ts: number, i: number) => ({
      time: ts,
      value: macdSignal[i]
    })).filter((d: { time: number; value: number | null }) => d.value !== null);
    
    const histogramData = timestamps.map((ts: number, i: number) => ({
      time: ts,
      value: histogram[i],
      color: (histogram[i] || 0) >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)'
    })).filter((d: { time: number; value: number | null }) => d.value !== null);
    
    // 52 week high/low from meta
    const fiftyTwoWeekHigh = meta?.fiftyTwoWeekHigh || Math.max(...highs);
    const fiftyTwoWeekLow = meta?.fiftyTwoWeekLow || Math.min(...lows);
    
    return NextResponse.json({
      symbol,
      name: meta?.shortName || symbol.replace('.NS', ''),
      currency: meta?.currency || 'INR',
      currentPrice,
      previousClose,
      change,
      changePercent,
      dayHigh: Math.max(...highs.slice(-96)), // Last trading day
      dayLow: Math.min(...lows.slice(-96)),
      volume: volumes[lastIndex],
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      indicators: {
        ma20: latestMa20,
        ma50: latestMa50,
        ma200: latestMa200,
        rsi: latestRsi,
        macd: latestMacd,
        macdSignal: latestMacdSignal,
        macdHistogram: histogram[lastIndex],
        bollingerUpper: latestBollingerUpper,
        bollingerMiddle: bollingerMiddle[lastIndex],
        bollingerLower: latestBollingerLower
      },
      supportResistance: {
        support,
        resistance
      },
      signal: signalAnalysis,
      sentiment,
      chartData: {
        candles: candleData,
        volumes: volumeData,
        ma20: ma20Data,
        ma50: ma50Data,
        bollingerUpper: bollingerUpperData,
        bollingerLower: bollingerLowerData,
        rsi: rsiData,
        macd: macdData,
        macdSignal: macdSignalData,
        macdHistogram: histogramData
      }
    });
    
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return NextResponse.json(
      { error: `Failed to fetch data for ${symbol}. ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
