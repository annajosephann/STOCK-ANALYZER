'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, RefreshCw, Sun, Moon, Plus, X, 
  ChevronDown, Info, BarChart3, Activity, Target, Zap, Star,
  Minus, AlertCircle, Clock
} from 'lucide-react';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { createChart, ColorType, IChartApi, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';

// Types
interface Stock {
  symbol: string;
  name: string;
  sector: string;
}

interface IndicatorSignals {
  maCrossover: { signal: string; reason: string };
  rsi: { signal: string; reason: string };
  macd: { signal: string; reason: string };
  bollinger: { signal: string; reason: string };
}

interface StockData {
  symbol: string;
  name: string;
  currency: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  indicators: {
    ma20: number | null;
    ma50: number | null;
    ma200: number | null;
    rsi: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    bollingerUpper: number | null;
    bollingerMiddle: number | null;
    bollingerLower: number | null;
  };
  supportResistance: {
    support: number[];
    resistance: number[];
  };
  signal: {
    confidence: number;
    signal: string;
    signals: IndicatorSignals;
  };
  sentiment: {
    sentiment: string;
    score: number;
  };
  chartData: {
    candles: Array<{ time: number; open: number; high: number; low: number; close: number }>;
    volumes: Array<{ time: number; value: number; color: string }>;
    ma20: Array<{ time: number; value: number }>;
    ma50: Array<{ time: number; value: number }>;
    bollingerUpper: Array<{ time: number; value: number }>;
    bollingerLower: Array<{ time: number; value: number }>;
    rsi: Array<{ time: number; value: number }>;
    macd: Array<{ time: number; value: number }>;
    macdSignal: Array<{ time: number; value: number }>;
    macdHistogram: Array<{ time: number; value: number; color: string }>;
  };
}

const STORAGE_KEY_WATCHLIST = 'stock-watchlist';
const STORAGE_KEY_THEME = 'stock-dashboard-theme';

export default function Dashboard() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<string>('RELIANCE.NS');
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [compareData, setCompareData] = useState<StockData | null>(null);
  const [compareStock, setCompareStock] = useState<string>('');
  const [compareMode, setCompareMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [stockOpen, setStockOpen] = useState(false);
  const { toast } = useToast();
  
  // Chart refs
  const candleChartRef = useRef<IChartApi | null>(null);
  const candleChartContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const rsiChartContainerRef = useRef<HTMLDivElement>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const macdChartContainerRef = useRef<HTMLDivElement>(null);
  
  // Compare chart refs
  const compareCandleChartRef = useRef<IChartApi | null>(null);
  const compareCandleChartContainerRef = useRef<HTMLDivElement>(null);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) as 'light' | 'dark' | 'system' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  // Load watchlist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WATCHLIST);
    if (saved) {
      setWatchlist(JSON.parse(saved));
    }
  }, []);

  // Fetch stocks list
  useEffect(() => {
    async function fetchStocks() {
      try {
        const res = await fetch('/api/stocks');
        const data = await res.json();
        setStocks(data.stocks);
      } catch (error) {
        console.error('Failed to fetch stocks list:', error);
        toast({
          title: 'Error',
          description: 'Failed to load stocks list',
          variant: 'destructive',
        });
      } finally {
        setStocksLoading(false);
      }
    }
    fetchStocks();
  }, [toast]);

  // Fetch stock data
  const fetchStockData = useCallback(async (symbol: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock/${symbol}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStockData(data);
    } catch (error) {
      console.error('Failed to fetch stock data:', error);
      toast({
        title: 'Error',
        description: `Failed to load data for ${symbol}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch compare data
  const fetchCompareData = useCallback(async (symbol: string) => {
    try {
      const res = await fetch(`/api/stock/${symbol}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCompareData(data);
    } catch (error) {
      console.error('Failed to fetch compare data:', error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStockData(selectedStock);
  }, [selectedStock, fetchStockData]);

  // Fetch compare data when compare stock changes
  useEffect(() => {
    if (compareMode && compareStock) {
      fetchCompareData(compareStock);
    }
  }, [compareStock, compareMode, fetchCompareData]);

  // Auto-refresh countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchStockData(selectedStock);
          if (compareMode && compareStock) {
            fetchCompareData(compareStock);
          }
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedStock, compareMode, compareStock, fetchStockData, fetchCompareData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        fetchStockData(selectedStock);
        setRefreshCountdown(60);
      }
      if (e.key === '+' && stockData) {
        toggleWatchlist(stockData.symbol);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStock, stockData, fetchStockData]);

  // Initialize candlestick chart
  useEffect(() => {
    if (!stockData || !candleChartContainerRef.current) return;

    // Clear previous chart
    if (candleChartRef.current) {
      candleChartRef.current.remove();
    }

    const isDark = document.documentElement.classList.contains('dark');
    
    const chart = createChart(candleChartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#94a3b8' : '#64748b',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)' },
        horzLines: { color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)' },
      },
      width: candleChartContainerRef.current.clientWidth,
      height: 400,
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)',
      },
      timeScale: {
        borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)',
        timeVisible: true,
      },
    });

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });
    candleSeries.setData(stockData.chartData.candles as never[]);

    // MA20 line
    const ma20Series = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma20Series.setData(stockData.chartData.ma20 as never[]);

    // MA50 line
    const ma50Series = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma50Series.setData(stockData.chartData.ma50 as never[]);

    // Bollinger Upper
    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: 'rgba(139, 92, 246, 0.5)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bbUpperSeries.setData(stockData.chartData.bollingerUpper as never[]);

    // Bollinger Lower
    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: 'rgba(139, 92, 246, 0.5)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bbLowerSeries.setData(stockData.chartData.bollingerLower as never[]);

    // Volume
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeries.setData(stockData.chartData.volumes as never[]);

    candleChartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (candleChartContainerRef.current && candleChartRef.current) {
        candleChartRef.current.applyOptions({ width: candleChartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (candleChartRef.current) {
        candleChartRef.current.remove();
      }
    };
  }, [stockData, theme]);

  // Initialize RSI chart
  useEffect(() => {
    if (!stockData || !rsiChartContainerRef.current) return;

    if (rsiChartRef.current) {
      rsiChartRef.current.remove();
    }

    const isDark = document.documentElement.classList.contains('dark');
    
    const chart = createChart(rsiChartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#94a3b8' : '#64748b',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)' },
        horzLines: { color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)' },
      },
      width: rsiChartContainerRef.current.clientWidth,
      height: 200,
      rightPriceScale: {
        borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)',
        visible: false,
      },
    });

    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#8b5cf6',
      lineWidth: 2,
    });
    rsiSeries.setData(stockData.chartData.rsi as never[]);

    // Add overbought/oversold levels
    rsiSeries.createPriceLine({
      price: 70,
      color: 'rgba(239, 68, 68, 0.5)',
      lineWidth: 1,
      lineStyle: 2,
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: 'rgba(34, 197, 94, 0.5)',
      lineWidth: 1,
      lineStyle: 2,
    });

    rsiChartRef.current = chart;

    const handleResize = () => {
      if (rsiChartContainerRef.current && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({ width: rsiChartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
      }
    };
  }, [stockData, theme]);

  // Initialize MACD chart
  useEffect(() => {
    if (!stockData || !macdChartContainerRef.current) return;

    if (macdChartRef.current) {
      macdChartRef.current.remove();
    }

    const isDark = document.documentElement.classList.contains('dark');
    
    const chart = createChart(macdChartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#94a3b8' : '#64748b',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)' },
        horzLines: { color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)' },
      },
      width: macdChartContainerRef.current.clientWidth,
      height: 200,
      rightPriceScale: {
        borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)',
      },
      timeScale: {
        borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)',
        visible: false,
      },
    });

    // MACD line
    const macdLineSeries = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      priceLineVisible: false,
    });
    macdLineSeries.setData(stockData.chartData.macd as never[]);

    // Signal line
    const signalLineSeries = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      priceLineVisible: false,
    });
    signalLineSeries.setData(stockData.chartData.macdSignal as never[]);

    // Histogram
    const histogramSeries = chart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
    });
    histogramSeries.setData(stockData.chartData.macdHistogram as never[]);

    macdChartRef.current = chart;

    const handleResize = () => {
      if (macdChartContainerRef.current && macdChartRef.current) {
        macdChartRef.current.applyOptions({ width: macdChartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (macdChartRef.current) {
        macdChartRef.current.remove();
      }
    };
  }, [stockData, theme]);

  // Compare chart
  useEffect(() => {
    if (!compareData || !compareCandleChartContainerRef.current) return;

    if (compareCandleChartRef.current) {
      compareCandleChartRef.current.remove();
    }

    const isDark = document.documentElement.classList.contains('dark');
    
    const chart = createChart(compareCandleChartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#94a3b8' : '#64748b',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)' },
        horzLines: { color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)' },
      },
      width: compareCandleChartContainerRef.current.clientWidth,
      height: 400,
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)',
      },
      timeScale: {
        borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)',
        timeVisible: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });
    candleSeries.setData(compareData.chartData.candles as never[]);

    compareCandleChartRef.current = chart;

    const handleResize = () => {
      if (compareCandleChartContainerRef.current && compareCandleChartRef.current) {
        compareCandleChartRef.current.applyOptions({ width: compareCandleChartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (compareCandleChartRef.current) {
        compareCandleChartRef.current.remove();
      }
    };
  }, [compareData, theme]);

  // Watchlist functions
  const toggleWatchlist = (symbol: string) => {
    const newWatchlist = watchlist.includes(symbol)
      ? watchlist.filter(s => s !== symbol)
      : [...watchlist, symbol];
    setWatchlist(newWatchlist);
    localStorage.setItem(STORAGE_KEY_WATCHLIST, JSON.stringify(newWatchlist));
    toast({
      title: watchlist.includes(symbol) ? 'Removed from Watchlist' : 'Added to Watchlist',
      description: `${symbol} has been ${watchlist.includes(symbol) ? 'removed from' : 'added to'} your watchlist`,
    });
  };

  // Get signal color
  const getSignalColor = (signal: string) => {
    switch (signal.toUpperCase()) {
      case 'BUY': return 'text-green-500';
      case 'SELL': return 'text-red-500';
      default: return 'text-yellow-500';
    }
  };

  // Get sentiment color
  const getSentimentColor = (sentiment: string) => {
    const s = sentiment.toLowerCase();
    if (s.includes('bullish')) return 'text-green-500';
    if (s.includes('bearish')) return 'text-red-500';
    return 'text-yellow-500';
  };

  // Format number
  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return 'N/A';
    if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  // Format price
  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined) return 'N/A';
    return '₹' + price.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const selectedStockInfo = stocks.find(s => s.symbol === selectedStock);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-4 md:p-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl md:text-3xl font-bold gradient-text flex items-center gap-2">
                📈 Indian Stock Market Dashboard
              </h1>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="pulse-glow absolute inline-flex h-full w-full rounded-full bg-green-500"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-sm text-muted-foreground">Live</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Refresh Timer */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Refresh in: {refreshCountdown}s</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    fetchStockData(selectedStock);
                    if (compareMode && compareStock) fetchCompareData(compareStock);
                    setRefreshCountdown(60);
                  }}
                  className="h-8 w-8"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Theme Toggle */}
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-muted-foreground" />
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => {
                    const newTheme = checked ? 'dark' : 'light';
                    setTheme(newTheme);
                    localStorage.setItem(STORAGE_KEY_THEME, newTheme);
                  }}
                />
                <Moon className="h-4 w-4 text-muted-foreground" />
              </div>
              
              {/* Compare Mode Toggle */}
              <div className="flex items-center gap-2">
                <Label htmlFor="compare-mode" className="text-sm">Compare</Label>
                <Switch
                  id="compare-mode"
                  checked={compareMode}
                  onCheckedChange={setCompareMode}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Stock Selector & Compare */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Main Stock Selector */}
          <div className="flex-1">
            <Popover open={stockOpen} onOpenChange={setStockOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={stockOpen}
                  className="w-full justify-between h-auto py-3 glass"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {selectedStockInfo?.name.charAt(0) || 'S'}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">{selectedStockInfo?.name || 'Select Stock'}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedStockInfo?.sector} • {selectedStockInfo?.symbol}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 ml-2 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0 glass" align="start">
                <Command>
                  <CommandInput placeholder="Search stocks..." />
                  <CommandList className="max-h-80">
                    <CommandEmpty>No stock found.</CommandEmpty>
                    <CommandGroup heading="NSE Stocks">
                      {stocks.map((stock) => (
                        <CommandItem
                          key={stock.symbol}
                          value={`${stock.name} ${stock.symbol} ${stock.sector}`}
                          onSelect={() => {
                            setSelectedStock(stock.symbol);
                            setStockOpen(false);
                          }}
                          className="flex items-center gap-3 py-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                            {stock.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{stock.name}</div>
                            <div className="text-xs text-muted-foreground">{stock.sector} • {stock.symbol}</div>
                          </div>
                          {watchlist.includes(stock.symbol) && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Compare Stock Selector */}
          {compareMode && (
            <div className="flex-1">
              <Select value={compareStock} onValueChange={setCompareStock}>
                <SelectTrigger className="glass h-auto py-3">
                  <SelectValue placeholder="Select stock to compare..." />
                </SelectTrigger>
                <SelectContent>
                  {stocks.filter(s => s.symbol !== selectedStock).map((stock) => (
                    <SelectItem key={stock.symbol} value={stock.symbol}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{stock.name}</span>
                        <span className="text-muted-foreground">({stock.symbol})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="glass">
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="glass">
              <CardContent className="p-6">
                <Skeleton className="h-[400px] w-full" />
              </CardContent>
            </Card>
          </div>
        ) : stockData ? (
          <div className="grid gap-6">
            {/* Price Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Price Card */}
              <Card className="glass card-hover">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Current Price</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">The latest traded price of the stock</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{formatPrice(stockData.currentPrice)}</span>
                    <span className={`text-sm font-medium flex items-center ${stockData.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {stockData.change >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                      {stockData.change >= 0 ? '+' : ''}{formatPrice(Math.abs(stockData.change))} ({stockData.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleWatchlist(stockData.symbol)}
                      className="gap-1"
                    >
                      {watchlist.includes(stockData.symbol) ? (
                        <>
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          Watching
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Watch
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Signal Confidence Card */}
              <Card className="glass card-hover">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Signal Confidence</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Combined confidence score based on MA, RSI, MACD, and Bollinger Bands</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 transform -rotate-90">
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          className="text-muted"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          stroke={stockData.signal.signal === 'BUY' ? '#22c55e' : stockData.signal.signal === 'SELL' ? '#ef4444' : '#eab308'}
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={`${(stockData.signal.confidence / 100) * 226} 226`}
                          className="confidence-animation"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-bold">{stockData.signal.confidence}%</span>
                      </div>
                    </div>
                    <div>
                      <Badge 
                        variant="outline"
                        className={`text-lg px-4 py-1 ${
                          stockData.signal.signal === 'BUY' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                          stockData.signal.signal === 'SELL' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        }`}
                      >
                        {stockData.signal.signal}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Market Sentiment Card */}
              <Card className="glass card-hover">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Market Sentiment</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Overall market mood based on RSI, MACD, and price vs moving averages</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-red-500 text-sm">Bearish</span>
                      <span className="text-green-500 text-sm">Bullish</span>
                    </div>
                    <div className="relative h-3 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500">
                      <div 
                        className="absolute w-4 h-4 bg-white border-2 border-gray-800 rounded-full top-1/2 -translate-y-1/2 shadow-lg transition-all duration-500"
                        style={{ left: `calc(${stockData.sentiment.score}% - 8px)` }}
                      />
                    </div>
                    <div className="text-center">
                      <span className={`text-lg font-bold ${getSentimentColor(stockData.sentiment.sentiment)}`}>
                        {stockData.sentiment.sentiment}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Key Statistics Card */}
              <Card className="glass card-hover">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Key Statistics</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Important price levels and trading volume</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Day High</span>
                      <p className="font-medium text-green-500">{formatPrice(stockData.dayHigh)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Day Low</span>
                      <p className="font-medium text-red-500">{formatPrice(stockData.dayLow)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Volume</span>
                      <p className="font-medium">{formatNumber(stockData.volume)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">52W High</span>
                      <p className="font-medium text-green-500">{formatPrice(stockData.fiftyTwoWeekHigh)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">52W Low</span>
                      <p className="font-medium text-red-500">{formatPrice(stockData.fiftyTwoWeekLow)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Signal Analysis Panel */}
            <Card className="glass">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Signal Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* MA Crossover */}
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">MA Crossover</span>
                      <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Moving Average Crossover: When MA20 crosses above MA50, it signals an uptrend. When it crosses below, it signals a downtrend.</p>
                      </TooltipContent>
                    </Tooltip>
                    </div>
                    <Badge className={cn(
                      stockData.signal.signals.maCrossover.signal === 'BUY' ? 'bg-green-500/10 text-green-500' :
                      stockData.signal.signals.maCrossover.signal === 'SELL' ? 'bg-red-500/10 text-red-500' :
                      'bg-yellow-500/10 text-yellow-500'
                    )}>
                      {stockData.signal.signals.maCrossover.signal}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">{stockData.signal.signals.maCrossover.reason}</p>
                  </div>

                  {/* RSI */}
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">RSI (14)</span>
                      <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Relative Strength Index: Measures momentum. RSI &lt;30 is oversold (potential buy), RSI &gt;70 is overbought (potential sell).</p>
                      </TooltipContent>
                    </Tooltip>
                    </div>
                    <Badge className={cn(
                      stockData.signal.signals.rsi.signal === 'BUY' ? 'bg-green-500/10 text-green-500' :
                      stockData.signal.signals.rsi.signal === 'SELL' ? 'bg-red-500/10 text-red-500' :
                      'bg-yellow-500/10 text-yellow-500'
                    )}>
                      {stockData.signal.signals.rsi.signal}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">{stockData.signal.signals.rsi.reason}</p>
                    <div className="mt-2">
                      <Progress value={stockData.indicators.rsi || 0} className="h-2" />
                    </div>
                  </div>

                  {/* MACD */}
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">MACD</span>
                      <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Moving Average Convergence Divergence: MACD above signal line is bullish, below is bearish. Histogram shows momentum strength.</p>
                      </TooltipContent>
                    </Tooltip>
                    </div>
                    <Badge className={cn(
                      stockData.signal.signals.macd.signal === 'BUY' ? 'bg-green-500/10 text-green-500' :
                      stockData.signal.signals.macd.signal === 'SELL' ? 'bg-red-500/10 text-red-500' :
                      'bg-yellow-500/10 text-yellow-500'
                    )}>
                      {stockData.signal.signals.macd.signal}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">{stockData.signal.signals.macd.reason}</p>
                  </div>

                  {/* Bollinger */}
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Bollinger Bands</span>
                      <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Bollinger Bands show volatility. Price near upper band may be overbought, near lower band may be oversold.</p>
                      </TooltipContent>
                    </Tooltip>
                    </div>
                    <Badge className={cn(
                      stockData.signal.signals.bollinger.signal === 'BUY' ? 'bg-green-500/10 text-green-500' :
                      stockData.signal.signals.bollinger.signal === 'SELL' ? 'bg-red-500/10 text-red-500' :
                      'bg-yellow-500/10 text-yellow-500'
                    )}>
                      {stockData.signal.signals.bollinger.signal}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">{stockData.signal.signals.bollinger.reason}</p>
                  </div>
                </div>

                {/* Overall Recommendation */}
                <div className="mt-4 p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Target className={cn(
                      "h-8 w-8",
                      stockData.signal.signal === 'BUY' ? 'text-green-500' :
                      stockData.signal.signal === 'SELL' ? 'text-red-500' :
                      'text-yellow-500'
                    )} />
                    <div>
                      <h4 className="font-semibold">
                        Overall Recommendation: <span className={getSignalColor(stockData.signal.signal)}>{stockData.signal.signal}</span>
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Based on {stockData.signal.confidence}% confidence from combined technical indicators
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Charts Section */}
            <div className={cn("grid gap-6", compareMode ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
              {/* Main Stock Charts */}
              <div className="space-y-6">
                {/* Candlestick Chart */}
                <Card className="glass">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-500" />
                        {stockData.name} - Price Chart
                      </CardTitle>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-0.5 bg-blue-500"></div>
                          <span>MA20</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-0.5 bg-yellow-500"></div>
                          <span>MA50</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-0.5 bg-purple-500 opacity-50"></div>
                          <span>BB</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div ref={candleChartContainerRef} className="w-full" />
                  </CardContent>
                </Card>

                {/* RSI Chart */}
                <Card className="glass">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5 text-purple-500" />
                      RSI Indicator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div ref={rsiChartContainerRef} className="w-full" />
                  </CardContent>
                </Card>

                {/* MACD Chart */}
                <Card className="glass">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                      MACD Indicator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div ref={macdChartContainerRef} className="w-full" />
                  </CardContent>
                </Card>
              </div>

              {/* Compare Charts */}
              {compareMode && compareData && (
                <div className="space-y-6">
                  {/* Compare Candlestick Chart */}
                  <Card className="glass">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-purple-500" />
                          {compareData.name} - Price Chart
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div ref={compareCandleChartContainerRef} className="w-full" />
                    </CardContent>
                  </Card>

                  {/* Compare Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="glass">
                      <CardContent className="p-4">
                        <h4 className="text-sm text-muted-foreground mb-2">{stockData.name}</h4>
                        <div className="text-2xl font-bold">{formatPrice(stockData.currentPrice)}</div>
                        <div className={cn("text-sm", stockData.change >= 0 ? "text-green-500" : "text-red-500")}>
                          {stockData.changePercent >= 0 ? '+' : ''}{stockData.changePercent.toFixed(2)}%
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="glass">
                      <CardContent className="p-4">
                        <h4 className="text-sm text-muted-foreground mb-2">{compareData.name}</h4>
                        <div className="text-2xl font-bold">{formatPrice(compareData.currentPrice)}</div>
                        <div className={cn("text-sm", compareData.change >= 0 ? "text-green-500" : "text-red-500")}>
                          {compareData.changePercent >= 0 ? '+' : ''}{compareData.changePercent.toFixed(2)}%
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Compare Signals */}
                  <Card className="glass">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Signal Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">{stockData.name}</div>
                          <Badge className={cn(
                            "mt-2",
                            stockData.signal.signal === 'BUY' ? 'bg-green-500/10 text-green-500' :
                            stockData.signal.signal === 'SELL' ? 'bg-red-500/10 text-red-500' :
                            'bg-yellow-500/10 text-yellow-500'
                          )}>
                            {stockData.signal.signal} ({stockData.signal.confidence}%)
                          </Badge>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">{compareData.name}</div>
                          <Badge className={cn(
                            "mt-2",
                            compareData.signal.signal === 'BUY' ? 'bg-green-500/10 text-green-500' :
                            compareData.signal.signal === 'SELL' ? 'bg-red-500/10 text-red-500' :
                            'bg-yellow-500/10 text-yellow-500'
                          )}>
                            {compareData.signal.signal} ({compareData.signal.confidence}%)
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Watchlist Panel */}
            {watchlist.length > 0 && (
              <Card className="glass">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      Watchlist
                    </CardTitle>
                    <Badge variant="outline">{watchlist.length} stocks</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {watchlist.map((symbol) => {
                      const stockInfo = stocks.find(s => s.symbol === symbol);
                      return (
                        <div
                          key={symbol}
                          className="p-4 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setSelectedStock(symbol);
                            setCompareMode(false);
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                                {stockInfo?.name.charAt(0) || symbol.charAt(0)}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{stockInfo?.name || symbol}</div>
                                <div className="text-xs text-muted-foreground">{symbol}</div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleWatchlist(symbol);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Support/Resistance Levels */}
            <Card className="glass">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Support & Resistance Levels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-green-500 mb-3">Support Levels</h4>
                    <div className="space-y-2">
                      {stockData.supportResistance.support.map((level, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded bg-green-500/10">
                          <span className="text-sm">S{i + 1}</span>
                          <span className="font-medium">{formatPrice(level)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-red-500 mb-3">Resistance Levels</h4>
                    <div className="space-y-2">
                      {stockData.supportResistance.resistance.map((level, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded bg-red-500/10">
                          <span className="text-sm">R{i + 1}</span>
                          <span className="font-medium">{formatPrice(level)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Keyboard Shortcuts Help */}
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground py-4">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded bg-muted">R</kbd>
                <span>Refresh</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded bg-muted">+</kbd>
                <span>Add to Watchlist</span>
              </div>
            </div>
          </div>
        ) : (
          <Card className="glass p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Data Available</h3>
            <p className="text-muted-foreground">Please select a stock to view its data</p>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
