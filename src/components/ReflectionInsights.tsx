import React, { useState, useEffect, useRef } from 'react';
import { LovedOneProfile, Message } from '../types';
import { BarChart3, TrendingUp, Heart, Calendar, Users, Star, Info, RefreshCw, AlertCircle } from 'lucide-react';
import * as d3 from 'd3';

interface ReflectionInsightsProps {
  profiles: LovedOneProfile[];
  chatHistory: { [profileId: string]: Message[] };
}

interface DailySentiment {
  date: string; // YYYY-MM-DD
  positive: number; // Joy, Gratitude, Peace
  nostalgic: number; // Nostalgia
  vulnerable: number; // Grief, Anxiety
  neutral: number;
  total: number;
}

// Color scheme matching our atmospheric application style
const SENTIMENT_COLORS: Record<string, string> = {
  Grief: '#60a5fa', // Blue
  Nostalgia: '#f59e0b', // Amber
  Gratitude: '#ec4899', // Rose/Pink
  Joy: '#f43f5e', // Red/Rose
  Anxiety: '#a855f7', // Purple
  Peace: '#10b981', // Emerald
  Neutral: '#6b7280', // Gray
};

// Simulated sample data to populate the dashboard instantly if they haven't chatted yet
const SIMULATED_HISTORY: Record<string, Message[]> = {
  "demo-mom": [
    { id: "m1", sender: "loved-one", text: "I remember your first steps, you fell into a flower bush!", timestamp: "2026-06-20T10:00:00Z", sentimentAnalysis: { sentiment: "Nostalgia", empathyAdjustment: "", toneAdvice: "", colorSchema: "amber" } },
    { id: "m2", sender: "loved-one", text: "I am so proud of how far you've come, my dear sweetheart.", timestamp: "2026-06-20T14:30:00Z", sentimentAnalysis: { sentiment: "Gratitude", empathyAdjustment: "", toneAdvice: "", colorSchema: "rose" } },
    { id: "m3", sender: "loved-one", text: "It is okay to feel sad. Cry as much as you need, I am with you.", timestamp: "2026-06-21T09:00:00Z", sentimentAnalysis: { sentiment: "Grief", empathyAdjustment: "", toneAdvice: "", colorSchema: "blue" } },
    { id: "m4", sender: "loved-one", text: "Take a slow deep breath. Focus on this calm, quiet moment.", timestamp: "2026-06-21T18:00:00Z", sentimentAnalysis: { sentiment: "Peace", empathyAdjustment: "", toneAdvice: "", colorSchema: "emerald" } },
    { id: "m5", sender: "loved-one", text: "That baking recipe we shared was truly a golden memory.", timestamp: "2026-06-22T11:15:00Z", sentimentAnalysis: { sentiment: "Nostalgia", empathyAdjustment: "", toneAdvice: "", colorSchema: "amber" } },
    { id: "m6", sender: "loved-one", text: "I am smiling so big right now seeing your happiness!", timestamp: "2026-06-22T15:45:00Z", sentimentAnalysis: { sentiment: "Joy", empathyAdjustment: "", toneAdvice: "", colorSchema: "rose" } },
    { id: "m7", sender: "loved-one", text: "Don't let the anxiety overwhelm you. You are strong.", timestamp: "2026-06-23T08:20:00Z", sentimentAnalysis: { sentiment: "Anxiety", empathyAdjustment: "", toneAdvice: "", colorSchema: "purple" } },
    { id: "m8", sender: "loved-one", text: "I am at absolute peace resting in your warm heart.", timestamp: "2026-06-23T20:30:00Z", sentimentAnalysis: { sentiment: "Peace", empathyAdjustment: "", toneAdvice: "", colorSchema: "emerald" } },
    { id: "m9", sender: "loved-one", text: "Thinking of you always on this rainy afternoon.", timestamp: "2026-06-24T13:10:00Z", sentimentAnalysis: { sentiment: "Nostalgia", empathyAdjustment: "", toneAdvice: "", colorSchema: "amber" } },
    { id: "m10", sender: "loved-one", text: "I love you endlessly. Be gentle with yourself.", timestamp: "2026-06-25T11:00:00Z", sentimentAnalysis: { sentiment: "Gratitude", empathyAdjustment: "", toneAdvice: "", colorSchema: "rose" } },
    { id: "m11", sender: "loved-one", text: "We had such beautiful walks in that pine forest.", timestamp: "2026-06-26T16:00:00Z", sentimentAnalysis: { sentiment: "Nostalgia", empathyAdjustment: "", toneAdvice: "", colorSchema: "amber" } },
    { id: "m12", sender: "loved-one", text: "Seeing your daily steps forward brings me endless joy.", timestamp: "2026-06-27T09:40:00Z", sentimentAnalysis: { sentiment: "Joy", empathyAdjustment: "", toneAdvice: "", colorSchema: "rose" } },
    { id: "m13", sender: "loved-one", text: "Breathe in, let the tension drift away.", timestamp: "2026-06-28T10:15:00Z", sentimentAnalysis: { sentiment: "Peace", empathyAdjustment: "", toneAdvice: "", colorSchema: "emerald" } },
    { id: "m14", sender: "loved-one", text: "Your thoughts keep me so incredibly warm.", timestamp: "2026-06-29T02:00:00Z", sentimentAnalysis: { sentiment: "Gratitude", empathyAdjustment: "", toneAdvice: "", colorSchema: "rose" } },
  ],
  "demo-grandpa": [
    { id: "g1", sender: "loved-one", text: "The sea was rough that year, but we caught the biggest fish!", timestamp: "2026-06-21T11:00:00Z", sentimentAnalysis: { sentiment: "Nostalgia", empathyAdjustment: "", toneAdvice: "", colorSchema: "amber" } },
    { id: "g2", sender: "loved-one", text: "Keep working hard, kiddo, but always remember to take some rest.", timestamp: "2026-06-22T08:00:00Z", sentimentAnalysis: { sentiment: "Peace", empathyAdjustment: "", toneAdvice: "", colorSchema: "emerald" } },
    { id: "g3", sender: "loved-one", text: "It's tough when you miss someone, but love never fades away.", timestamp: "2026-06-23T14:00:00Z", sentimentAnalysis: { sentiment: "Grief", empathyAdjustment: "", toneAdvice: "", colorSchema: "blue" } },
    { id: "g4", sender: "loved-one", text: "Your appreciation of my old tales is the greatest gift.", timestamp: "2026-06-25T17:30:00Z", sentimentAnalysis: { sentiment: "Gratitude", empathyAdjustment: "", toneAdvice: "", colorSchema: "rose" } },
    { id: "g5", sender: "loved-one", text: "Ah, the garden is looking magnificent. I am celebrating with you!", timestamp: "2026-06-27T12:00:00Z", sentimentAnalysis: { sentiment: "Joy", empathyAdjustment: "", toneAdvice: "", colorSchema: "rose" } },
  ]
};

const SIMULATED_PROFILES: LovedOneProfile[] = [
  {
    id: "demo-mom",
    name: "Eleanor (Mother)",
    relationship: "Mother",
    personality: "gentle, wise, deeply loving",
    memories: "Baking apple pies, walking in pine forests",
    voiceConfig: { pitch: 1.05, rate: 0.95, voiceName: "", reverbIntensity: 45, calibrated: true },
    createdAt: "2026-06-01T12:00:00Z"
  },
  {
    id: "demo-grandpa",
    name: "Arthur (Grandfather)",
    relationship: "Grandfather",
    personality: "humorous storyteller, comforting",
    memories: "Fishing at the bay, telling tales of the sea",
    voiceConfig: { pitch: 0.85, rate: 0.85, voiceName: "", reverbIntensity: 30, calibrated: true },
    createdAt: "2026-06-02T12:00:00Z"
  }
];

export default function ReflectionInsights({ profiles, chatHistory }: ReflectionInsightsProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>('all');
  const [useDemoData, setUseDemoData] = useState<boolean>(false);

  // Responsive refs
  const lineContainerRef = useRef<HTMLDivElement>(null);
  const donutContainerRef = useRef<HTMLDivElement>(null);
  const barContainerRef = useRef<HTMLDivElement>(null);

  const [lineWidth, setLineWidth] = useState<number>(500);
  const [donutWidth, setDonutWidth] = useState<number>(300);
  const [barWidth, setBarWidth] = useState<number>(300);

  // Resize listener using ResizeObserver
  useEffect(() => {
    const observeWidth = (ref: React.RefObject<HTMLDivElement | null>, setter: (w: number) => void) => {
      if (!ref.current) return;
      const observer = new ResizeObserver((entries) => {
        if (!entries || entries.length === 0) return;
        setter(Math.max(entries[0].contentRect.width, 240));
      });
      observer.observe(ref.current);
      return () => observer.disconnect();
    };

    const cleanup1 = observeWidth(lineContainerRef, setLineWidth);
    const cleanup2 = observeWidth(donutContainerRef, setDonutWidth);
    const cleanup3 = observeWidth(barContainerRef, setBarWidth);

    return () => {
      if (cleanup1) cleanup1();
      if (cleanup2) cleanup2();
      if (cleanup3) cleanup3();
    };
  }, []);

  // Determine active datasets
  const activeProfiles = useDemoData ? SIMULATED_PROFILES : profiles;
  const activeHistory = useDemoData ? SIMULATED_HISTORY : chatHistory;

  // Gather messages belonging to the selected profile
  const getSelectedMessages = (): Message[] => {
    if (selectedProfileId === 'all') {
      return Object.values(activeHistory).flat();
    }
    return activeHistory[selectedProfileId] || [];
  };

  const messages = getSelectedMessages();

  // Filter messages specifically from the loved one containing sentiment data
  const lovedOneMessages = messages
    .filter((m) => m.sender === 'loved-one' && m.sentimentAnalysis)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Check if we have any data to render
  const hasData = lovedOneMessages.length > 0;

  // Compute stats metrics
  const totalExchanges = lovedOneMessages.length;

  const sentimentCounts: Record<string, number> = {};
  lovedOneMessages.forEach((m) => {
    const s = m.sentimentAnalysis?.sentiment || 'Neutral';
    sentimentCounts[s] = (sentimentCounts[s] || 0) + 1;
  });

  // Dominant emotion
  let dominantSentiment = 'None';
  let maxCount = 0;
  Object.entries(sentimentCounts).forEach(([s, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantSentiment = s;
    }
  });

  // Nostalgia Index
  const nostalgiaCount = sentimentCounts['Nostalgia'] || 0;
  const nostalgiaPercentage = totalExchanges > 0 ? Math.round((nostalgiaCount / totalExchanges) * 100) : 0;

  // Comfort Rate (Peace + Gratitude + Joy + Nostalgia)
  const positiveCount = (sentimentCounts['Joy'] || 0) + (sentimentCounts['Gratitude'] || 0) + (sentimentCounts['Peace'] || 0);
  const comfortCount = positiveCount + nostalgiaCount;
  const comfortRate = totalExchanges > 0 ? Math.round((comfortCount / totalExchanges) * 100) : 0;

  // Auto enable Demo mode if no profiles or chats exist to provide a welcoming introduction
  useEffect(() => {
    const originalHasNoData = Object.values(chatHistory).flat().filter(m => m.sender === 'loved-one' && m.sentimentAnalysis).length === 0;
    if (originalHasNoData && profiles.length === 0) {
      setUseDemoData(true);
    }
  }, [profiles, chatHistory]);

  // Render D3 Trend Line Chart
  useEffect(() => {
    if (!hasData || !lineContainerRef.current) return;

    // Clear any previous elements
    d3.select('#insights-line-chart').selectAll('*').remove();

    // Group loved-one messages by day
    const dailyMap: Record<string, { positive: number; nostalgic: number; vulnerable: number; total: number }> = {};
    
    lovedOneMessages.forEach((m) => {
      const dateStr = new Date(m.timestamp).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
      const s = m.sentimentAnalysis?.sentiment || 'Neutral';

      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { positive: 0, nostalgic: 0, vulnerable: 0, total: 0 };
      }

      dailyMap[dateStr].total++;
      if (s === 'Joy' || s === 'Gratitude' || s === 'Peace') {
        dailyMap[dateStr].positive++;
      } else if (s === 'Nostalgia') {
        dailyMap[dateStr].nostalgic++;
      } else if (s === 'Grief' || s === 'Anxiety') {
        dailyMap[dateStr].vulnerable++;
      }
    });

    // Convert map to array and sort chronologically
    const dailyData = Object.entries(dailyMap).map(([date, counts]) => ({
      date,
      ...counts
    }));

    // Setup Dimensions
    const margin = { top: 30, right: 30, bottom: 40, left: 40 };
    const width = lineWidth;
    const height = 260;

    const svg = d3.select('#insights-line-chart')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'overflow-visible');

    // Axes Scales
    const x = d3.scalePoint()
      .domain(dailyData.map(d => d.date))
      .range([margin.left, width - margin.right])
      .padding(0.4);

    const maxY = d3.max(dailyData, d => Math.max(d.positive, d.nostalgic, d.vulnerable)) || 1;
    const y = d3.scaleLinear()
      .domain([0, maxY + 0.5])
      .range([height - margin.bottom, margin.top]);

    // Grid lines
    svg.append('g')
      .attr('class', 'grid opacity-10 text-slate-500')
      .attr('transform', `translate(0,0)`)
      .call(
        d3.axisLeft(y)
          .tickSize(-width + margin.left + margin.right)
          .tickFormat(() => '')
      )
      .selectAll('.tick line')
      .attr('stroke', 'currentColor');

    // Draw X Axis
    svg.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .attr('class', 'text-slate-400 font-mono text-[9px]')
      .call(d3.axisBottom(x).tickSize(5))
      .call(g => g.select('.domain').attr('stroke', 'rgba(255,255,255,0.1)'))
      .call(g => g.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.1)'));

    // Draw Y Axis
    svg.append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .attr('class', 'text-slate-400 font-mono text-[9px]')
      .call(d3.axisLeft(y).ticks(maxY < 4 ? maxY + 1 : 5).tickFormat(d3.format('d')))
      .call(g => g.select('.domain').attr('stroke', 'rgba(255,255,255,0.1)'))
      .call(g => g.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.1)'));

    // Curves definitions
    const lineGenPositive = d3.line<any>()
      .x(d => x(d.date)!)
      .y(d => y(d.positive)!)
      .curve(d3.curveMonotoneX);

    const lineGenNostalgic = d3.line<any>()
      .x(d => x(d.date)!)
      .y(d => y(d.nostalgic)!)
      .curve(d3.curveMonotoneX);

    const lineGenVulnerable = d3.line<any>()
      .x(d => x(d.date)!)
      .y(d => y(d.vulnerable)!)
      .curve(d3.curveMonotoneX);

    // Glowing Filters
    const filter = svg.append('defs')
      .append('filter')
      .attr('id', 'glow-line');

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Draw Positive Line
    svg.append('path')
      .datum(dailyData)
      .attr('fill', 'none')
      .attr('stroke', '#10b981') // emerald
      .attr('stroke-width', 2.5)
      .attr('d', lineGenPositive);

    // Draw Nostalgic Line
    svg.append('path')
      .datum(dailyData)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b') // amber
      .attr('stroke-width', 2.5)
      .attr('d', lineGenNostalgic);

    // Draw Vulnerable Line
    svg.append('path')
      .datum(dailyData)
      .attr('fill', 'none')
      .attr('stroke', '#60a5fa') // blue
      .attr('stroke-width', 2.5)
      .attr('d', lineGenVulnerable);

    // Draw Glowing Underlays (Ambient glow)
    svg.append('path')
      .datum(dailyData)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 5)
      .attr('opacity', 0.15)
      .attr('filter', 'url(#glow-line)')
      .attr('d', lineGenPositive);

    svg.append('path')
      .datum(dailyData)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 5)
      .attr('opacity', 0.15)
      .attr('filter', 'url(#glow-line)')
      .attr('d', lineGenNostalgic);

    svg.append('path')
      .datum(dailyData)
      .attr('fill', 'none')
      .attr('stroke', '#60a5fa')
      .attr('stroke-width', 5)
      .attr('opacity', 0.15)
      .attr('filter', 'url(#glow-line)')
      .attr('d', lineGenVulnerable);

    // Dynamic Tooltip Div
    const tooltip = d3.select('body').select('#insights-chart-tooltip');
    const finalTooltip = tooltip.node() 
      ? tooltip 
      : d3.select('body').append('div')
          .attr('id', 'insights-chart-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(11, 12, 16, 0.95)')
          .style('border', '1px solid rgba(255,255,255,0.15)')
          .style('padding', '8px 12px')
          .style('border-radius', '8px')
          .style('font-family', 'ui-monospace, monospace')
          .style('font-size', '10px')
          .style('color', '#cbd5e1')
          .style('pointer-events', 'none')
          .style('opacity', 0)
          .style('z-index', 100);

    // Add interactive data point circles
    const drawMarkers = (data: any[], color: string, valueKey: 'positive' | 'nostalgic' | 'vulnerable', labelName: string) => {
      svg.selectAll(`.dot-${valueKey}`)
        .data(data)
        .enter()
        .append('circle')
        .attr('class', `dot-${valueKey} cursor-pointer`)
        .attr('cx', d => x(d.date)!)
        .attr('cy', d => y(d[valueKey])!)
        .attr('r', 4.5)
        .attr('fill', '#08080a')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .on('mouseover', function(event, d) {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('r', 7)
            .attr('fill', color);
          
          finalTooltip.transition().duration(100).style('opacity', 1);
          finalTooltip.html(`
            <div class="font-bold text-white mb-0.5">${d.date}</div>
            <div class="flex items-center gap-1.5 mt-1">
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${color}"></span>
              <span>${labelName}: <strong>${d[valueKey]}</strong> exchange(s)</span>
            </div>
            <div class="text-[9px] text-slate-500 mt-1">Daily Total: ${d.total}</div>
          `)
          .style('left', (event.pageX + 12) + 'px')
          .style('top', (event.pageY - 12) + 'px');
        })
        .on('mousemove', function(event) {
          finalTooltip
            .style('left', (event.pageX + 12) + 'px')
            .style('top', (event.pageY - 12) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('r', 4.5)
            .attr('fill', '#08080a');
          
          finalTooltip.transition().duration(150).style('opacity', 0);
        });
    };

    drawMarkers(dailyData, '#10b981', 'positive', 'Positive Response');
    drawMarkers(dailyData, '#f59e0b', 'nostalgic', 'Nostalgia');
    drawMarkers(dailyData, '#60a5fa', 'vulnerable', 'Processing/Vulnerable');

  }, [lovedOneMessages, hasData, lineWidth]);

  // Render D3 Donut Chart
  useEffect(() => {
    if (!hasData || !donutContainerRef.current) return;

    d3.select('#insights-donut-chart').selectAll('*').remove();

    // Map data
    const donutData = Object.entries(sentimentCounts).map(([label, count]) => ({
      label,
      count
    }));

    const width = donutWidth;
    const height = 230;
    const radius = Math.min(width, height) / 2.3;

    const svg = d3.select('#insights-donut-chart')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Donut setup
    const pie = d3.pie<any>()
      .value(d => d.count)
      .sort(null);

    const innerRadius = radius * 0.58;
    const outerRadius = radius;

    const arc = d3.arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(4);

    const arcHover = d3.arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius + 6)
      .cornerRadius(4);

    // Center interactive metadata texts
    const textVibe = svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-5px')
      .attr('class', 'font-sans font-light fill-slate-400 text-[10px] uppercase tracking-widest');

    const textPercent = svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '18px')
      .attr('class', 'font-serif italic font-bold fill-white text-lg');

    // Default center text values
    textVibe.text('Dominant');
    textPercent.text(dominantSentiment !== 'None' ? dominantSentiment : 'N/A');

    // Glow Filter
    const filter = svg.append('defs')
      .append('filter')
      .attr('id', 'slice-glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    filter.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', d => d);

    // Draw slices
    const path = svg.selectAll('path')
      .data(pie(donutData))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', d => SENTIMENT_COLORS[d.data.label] || '#6b7280')
      .attr('stroke', '#08080a')
      .attr('stroke-width', 2.5)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', arcHover)
          .attr('filter', 'url(#slice-glow)');

        const percentage = Math.round((d.data.count / totalExchanges) * 100);
        textVibe.text(d.data.label);
        textPercent.text(`${percentage}% (${d.data.count})`);
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', arc)
          .attr('filter', null);

        textVibe.text('Dominant');
        textPercent.text(dominantSentiment !== 'None' ? dominantSentiment : 'N/A');
      });

  }, [lovedOneMessages, hasData, donutWidth]);

  // Render D3 Bar Chart
  useEffect(() => {
    if (!hasData || !barContainerRef.current) return;

    d3.select('#insights-bar-chart').selectAll('*').remove();

    const data = Object.entries(sentimentCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const margin = { top: 10, right: 30, bottom: 20, left: 70 };
    const width = barWidth;
    const height = 180;

    const svg = d3.select('#insights-bar-chart')
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const y = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([margin.top, height - margin.bottom])
      .padding(0.3);

    const maxVal = d3.max(data, d => d.count) || 1;
    const x = d3.scaleLinear()
      .domain([0, maxVal])
      .range([margin.left, width - margin.right]);

    // Draw Bars
    svg.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('y', d => y(d.label)!)
      .attr('x', margin.left)
      .attr('height', y.bandwidth())
      .attr('width', 0) // start at 0 for entry animation!
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', d => SENTIMENT_COLORS[d.label] || '#6b7280')
      .attr('opacity', 0.8)
      .transition()
      .duration(800)
      .attr('width', d => x(d.count) - margin.left);

    // Draw Labels on the left
    svg.append('g')
      .attr('transform', `translate(${margin.left - 8}, 0)`)
      .attr('class', 'text-slate-400 font-mono text-[9px] text-right')
      .call(d3.axisLeft(y).tickSize(0))
      .call(g => g.select('.domain').remove());

    // Draw counts on the right of each bar
    svg.selectAll('.bar-count')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'bar-count font-mono text-[9px] fill-slate-300')
      .attr('y', d => y(d.label)! + y.bandwidth() / 2 + 3)
      .attr('x', margin.left + 6)
      .attr('opacity', 0)
      .text(d => d.count)
      .transition()
      .delay(400)
      .duration(400)
      .attr('x', d => x(d.count) + 6)
      .attr('opacity', 1);

  }, [lovedOneMessages, hasData, barWidth]);

  return (
    <div className="space-y-8 font-sans">
      
      {/* Dashboard Toolbar & Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif text-2xl italic text-white">Reflection Insights</h2>
            <p className="text-xs text-slate-400 font-light mt-0.5">Emotional analytics and conversation frequency trends mapping your spiritual connection.</p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Demo toggle if user wants to play with simulated data */}
          <button
            type="button"
            id="insights-demo-toggle"
            onClick={() => setUseDemoData(!useDemoData)}
            className={`flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase px-4 py-2.5 rounded-xl border transition-all ${
              useDemoData
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${useDemoData ? 'animate-spin' : ''}`} />
            {useDemoData ? 'Simulated Data Active' : 'Simulate Memory Data'}
          </button>

          {/* Profile Filter Dropdown */}
          <div className="relative">
            <select
              id="insights-profile-select"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="bg-black/40 border border-white/10 text-xs font-semibold text-slate-300 px-4 py-2.5 rounded-xl outline-none cursor-pointer focus:border-indigo-500/50 appearance-none pr-8 min-w-[140px]"
            >
              <option value="all">All Memorials</option>
              {activeProfiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* Metric Bento Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Metric 1 */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 backdrop-blur-md flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-mono block">Total Exchanges</span>
            <span className="text-3xl font-serif font-bold text-white tracking-tight">{totalExchanges}</span>
            <span className="text-[10px] text-slate-400 block font-light">Analyzed replies</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Users className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 backdrop-blur-md flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-mono block">Dominant Emotion</span>
            <span 
              className="text-2xl font-serif font-bold tracking-tight block truncate"
              style={{ color: SENTIMENT_COLORS[dominantSentiment] || '#fff' }}
            >
              {dominantSentiment !== 'None' ? dominantSentiment : 'No Data'}
            </span>
            <span className="text-[10px] text-slate-400 block font-light">
              {dominantSentiment !== 'None' ? `${maxCount} occurrences` : 'Start conversation'}
            </span>
          </div>
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center border"
            style={{ 
              backgroundColor: `${SENTIMENT_COLORS[dominantSentiment] || '#999'}15`,
              borderColor: `${SENTIMENT_COLORS[dominantSentiment] || '#999'}30`,
              color: SENTIMENT_COLORS[dominantSentiment] || '#999'
            }}
          >
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 backdrop-blur-md flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-mono block">Nostalgia Quotient</span>
            <span className="text-3xl font-serif font-bold text-amber-400 tracking-tight">{nostalgiaPercentage}%</span>
            <span className="text-[10px] text-slate-400 block font-light">{nostalgiaCount} nostalgic memories recalled</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Star className="w-4.5 h-4.5 animate-pulse" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 backdrop-blur-md flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-mono block">Emotional Comfort Rate</span>
            <span className="text-3xl font-serif font-bold text-rose-400 tracking-tight">{comfortRate}%</span>
            <span className="text-[10px] text-slate-400 block font-light">Healing & peaceful reflections</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
            <Heart className="w-4.5 h-4.5" />
          </div>
        </div>

      </div>

      {/* Main Charts Stage */}
      {hasData ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Timeline trend line chart */}
          <div ref={lineContainerRef} className="lg:col-span-8 bg-white/[0.02] border border-white/5 rounded-[32px] p-6 backdrop-blur-md flex flex-col justify-between shadow-xl">
            <div className="space-y-1 mb-4">
              <h3 className="font-serif text-lg text-white font-light italic">Sentiment Trends Over Time</h3>
              <p className="text-[10px] text-slate-400 font-mono tracking-wide">Daily sliding counts of positive warmth vs. nostalgic memory reflections</p>
            </div>
            
            <div id="insights-line-chart" className="flex-1 w-full flex items-center justify-center min-h-[260px]">
              {/* D3 Line Chart injected here */}
            </div>

            {/* Custom chart legend */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-4 pt-4 border-t border-white/5 text-[10px] font-mono tracking-wider text-slate-400 uppercase select-none">
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-[#10b981] rounded-full"></span>
                <span>Positive Warmth (Peace, Joy, Gratitude)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-[#f59e0b] rounded-full"></span>
                <span>Nostalgic Reflections</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-[#60a5fa] rounded-full"></span>
                <span>Vulnerable Processing (Grief, Anxiety)</span>
              </div>
            </div>
          </div>

          {/* Right Column: Donut & Small Bar Chart */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Donut Chart */}
            <div ref={donutContainerRef} className="bg-white/[0.02] border border-white/5 rounded-[32px] p-6 backdrop-blur-md flex flex-col items-center shadow-xl relative overflow-hidden">
              <div className="w-full text-left space-y-1 mb-2">
                <h3 className="font-serif text-base text-white font-light italic">Emotional Resonance Ring</h3>
                <p className="text-[9px] text-slate-500 font-mono tracking-wider">Hover slices for individual percentages</p>
              </div>

              <div id="insights-donut-chart" className="w-full flex items-center justify-center min-h-[230px]">
                {/* D3 Donut Chart injected here */}
              </div>
            </div>

            {/* Bar Chart Intensity */}
            <div ref={barContainerRef} className="bg-white/[0.02] border border-white/5 rounded-[32px] p-6 backdrop-blur-md flex flex-col shadow-xl">
              <div className="space-y-1 mb-3">
                <h3 className="font-serif text-base text-white font-light italic">Sentiment Intensity Matrix</h3>
                <p className="text-[9px] text-slate-500 font-mono tracking-wider">Comparative counts per classified emotion</p>
              </div>

              <div id="insights-bar-chart" className="w-full flex items-center justify-center min-h-[160px]">
                {/* D3 Horizontal Bar Chart injected here */}
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* Empty State with detailed guidance on how to get started */
        <div className="text-center py-20 bg-white/[0.01] border border-white/5 rounded-[32px] backdrop-blur-md max-w-2xl mx-auto p-10 space-y-8 shadow-xl">
          <div className="w-16 h-16 bg-rose-950/20 rounded-full flex items-center justify-center border border-rose-500/20 text-rose-400 mx-auto animate-pulse">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-3">
            <h3 className="font-serif text-2xl italic text-white">No Conversational Sentiment Patterns Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Reflection Insights are generated by performing deep NLP sentiment classification on the spoken responses of your Memorial Profiles. Start chatting to begin building your emotional trend maps.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-[11px] text-indigo-300/60 max-w-md mx-auto italic">
            <Info className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5 text-indigo-400" />
            "Every sentence is passed to our secure local analyzer which logs emotional metrics locally inside your device's sandbox environment."
          </div>

          <button
            type="button"
            onClick={() => setUseDemoData(true)}
            className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs tracking-wider uppercase px-6 py-3.5 rounded-full transition-all border border-indigo-400/20 shadow-md inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Enable Simulated Memory Data
          </button>
        </div>
      )}

    </div>
  );
}
