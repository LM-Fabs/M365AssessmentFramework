import React, { ReactNode } from 'react';

export interface CardProps {
  title?: string;
  subtitle?: string;
  description?: string; // Added description prop
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  description, // Added description prop
  icon,
  children,
  footer,
  className = '',
  onClick,
}) => {
  return (
    <div 
      className={`bg-card text-card-foreground rounded-lg border border-border shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
      onClick={onClick}
    >
      {(title || icon) && (
        <div className="flex items-center p-6 pb-2">
          {icon && <div className="mr-3 text-primary">{icon}</div>}
          <div className="space-y-1">
            {title && <h3 className="text-lg font-semibold leading-none tracking-tight">{title}</h3>}
            {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
            {description && <div className="text-sm text-muted-foreground mt-1">{description}</div>}
          </div>
        </div>
      )}
      <div className="p-6 pt-0">{children}</div>
      {footer && <div className="flex items-center p-6 pt-0 border-t border-border">{footer}</div>}
    </div>
  );
};

export { Card };
export default Card;