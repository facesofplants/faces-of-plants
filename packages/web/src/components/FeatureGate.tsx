'use client';

import React from 'react';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
}

export function FeatureGate({ children }: FeatureGateProps) {
  return <>{children}</>;
}

export default FeatureGate;
