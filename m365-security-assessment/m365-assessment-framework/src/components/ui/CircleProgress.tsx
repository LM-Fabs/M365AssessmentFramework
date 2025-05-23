import React from 'react';
import './CircleProgress.css';

interface CircleProgressProps {
  percentage: number;
  size: number;
  strokeWidth: number;
  circleColor: string;
}

const CircleProgress: React.FC<CircleProgressProps> = ({ 
  percentage, 
  size, 
  strokeWidth, 
  circleColor 
}) => {
  // Calculate circle parameters
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="circle-progress" style={{ width: size, height: size }}>
      <svg
        className="circle-progress-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background circle */}
        <circle
          className="circle-progress-background"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={`${strokeWidth}px`}
        />
        
        {/* Progress circle */}
        <circle
          className="circle-progress-indicator"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={`${strokeWidth}px`}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: strokeDashoffset,
            stroke: circleColor
          }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </div>
  );
};

export default CircleProgress;