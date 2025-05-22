import React from 'react';
import './Card.css';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
}

interface CardHeaderProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

const CardHeader: React.FC<CardHeaderProps> = ({ title, description, action }) => {
  if (!title && !description && !action) return null;
  
  return (
    <div className="card-header">
      <div className="card-header-text">
        {title && <h3 className="card-title">{title}</h3>}
        {description && <p className="card-description">{description}</p>}
      </div>
      {action && <div className="card-header-action">{action}</div>}
    </div>
  );
};

const CardContent: React.FC<CardContentProps> = ({ children, className = '' }) => {
  return <div className={`card-content ${className}`}>{children}</div>;
};

const CardFooter: React.FC<CardFooterProps> = ({ children, className = '' }) => {
  return <div className={`card-footer ${className}`}>{children}</div>;
};

const Card: React.FC<CardProps> = ({
  children,
  title,
  description,
  className = '',
  footer,
  headerAction
}) => {
  return (
    <div className={`lm-card ${className}`}>
      <CardHeader title={title} description={description} action={headerAction} />
      <CardContent>{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </div>
  );
};

export { Card, CardHeader, CardContent, CardFooter };
export default Card;