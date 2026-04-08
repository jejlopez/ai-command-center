import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { agents } from '../utils/mockData';
import { AgentVitalCard } from '../components/AgentVitalCard';
import { container, item } from '../utils/variants';
import Globe from 'react-globe.gl';

const MapWidget = () => {
  const [arcsData, setArcsData] = useState([]);
  useEffect(() => {
    const N = 24;
    setArcsData([...Array(N).keys()].map(() => ({
      startLat: (Math.random() - 0.5) * 180,
      startLng: (Math.random() - 0.5) * 360,
      endLat: (Math.random() - 0.5) * 180,
      endLng: (Math.random() - 0.5) * 360,
      color: ['#00D9C8', '#a78bfa', '#60a5fa'][Math.floor(Math.random() * 3)]
    })));
  }, []);

  return (
    <div className="col-span-12 spatial-panel relative overflow-hidden h-[340px] flex items-center justify-center border-aurora-teal/20 shadow-glow-teal group">
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h3 className="text-xl font-bold text-text-primary tracking-wide">Global Protocol Trajectory</h3>
        <p className="text-sm font-mono text-aurora-teal mt-1">24 Active Satellite Downlinks</p>
      </div>
      <div className="absolute inset-0 -top-16 z-0 opacity-90 cursor-move mix-blend-screen scale-110 origin-center transition-transform duration-1000 group-hover:scale-125">
        <Globe
          width={1200}
          height={480}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          arcsData={arcsData}
          arcColor="color"
          arcDashLength={0.4}
          arcDashGap={2}
          arcDashAnimateTime={1500}
          backgroundColor="rgba(0,0,0,0)"
          atmosphereColor="#00D9C8"
          atmosphereAltitude={0.15}
        />
      </div>
    </div>
  );
};

export function FleetView({ onOpenDetail }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar pb-10">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-1">Agent Fleet</h2>
          <p className="text-sm text-text-muted">Monitor and control your deployed AI workforce.</p>
        </div>
        <div className="spatial-panel px-4 py-2 text-sm font-mono text-aurora-teal">
          {agents.length} Active Workforce
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5 mb-8">
        <MapWidget />
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-4">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">Live Instances</h3>
        <div className="grid grid-cols-12 gap-5 pb-4 pl-14 pr-6 pt-3 overflow-visible">
          <AnimatePresence mode="popLayout">
            {agents.map(a => (
              <motion.div key={a.id} variants={item} layout layoutId={`fleet-${a.id}`} className="col-span-4 h-64 relative z-10 hover:z-50 overflow-visible">
                <AgentVitalCard
                  agent={a}
                  onOpenDetail={() => onOpenDetail(a.id)}
                  onQuickDispatch={() => onOpenDetail(a.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
