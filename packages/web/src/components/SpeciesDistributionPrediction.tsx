'use client';

import { Brain, TrendUp, MapPin, Thermometer, CloudRain, Mountains } from '@phosphor-icons/react';
import React, { useState, useEffect, useCallback } from 'react';

import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';

import { useMode, getTextColors } from '../context/ModeContext';

interface SpeciesDistributionPredictionProps {
  occurrences: GBIFOccurrence[];
  speciesName: string;
}

interface PredictionData {
  suitability: number;
  confidence: number;
  factors: {
    temperature: number;
    precipitation: number;
    elevation: number;
    humanActivity: number;
  };
  recommendations: string[];
}

export const SpeciesDistributionPrediction: React.FC<SpeciesDistributionPredictionProps> = ({
  occurrences,
}) => {
  const { mode, theme } = useMode();
  const textColors = getTextColors(theme);
  const isCitizen = mode === 'citizen';

  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);

  // Mock prediction algorithm based on occurrence data
  const generatePrediction = useCallback(() => {
    if (occurrences.length === 0) {return null;}

    // Analyze geographic distribution
    const latitudes = occurrences
      .map((occ) => occ.decimalLatitude)
      .filter((lat): lat is number => lat !== undefined && lat !== null);
    const elevations = occurrences
      .map((occ) => occ.elevation)
      .filter((elev): elev is number => elev !== undefined && elev !== null);
    const countries = [...new Set(occurrences.map((occ) => occ.country))];

    // Calculate environmental preferences
    const avgLatitude =
      latitudes.length > 0 ? latitudes.reduce((sum, lat) => sum + lat, 0) / latitudes.length : 0;
    const latitudeRange =
      latitudes.length > 0 ? Math.max(...latitudes) - Math.min(...latitudes) : 0;
    const avgElevation =
      elevations.length > 0
        ? elevations.reduce((sum, elev) => sum + elev, 0) / elevations.length
        : 500;

    // Climate suitability (simplified)
    const temperatureSuitability = Math.max(0, 100 - Math.abs(avgLatitude) * 2);
    const elevationSuitability = Math.max(0, 100 - Math.abs(avgElevation - 1000) / 20);
    const precipitationSuitability = 60 + Math.random() * 40; // Mock value
    const humanActivitySuitability = 80 - countries.length * 2; // More widespread = less suitable for conservation

    // Overall suitability
    const suitability =
      (temperatureSuitability +
        elevationSuitability +
        precipitationSuitability +
        humanActivitySuitability) /
      4;
    const confidence = Math.min(90, occurrences.length * 2); // More data = higher confidence

    // Generate recommendations based on analysis
    const recommendations = [];

    if (temperatureSuitability < 50) {
      recommendations.push(
        isCitizen
          ? 'This species prefers cooler climates - consider temperature when choosing planting locations'
          : 'Temperature is a limiting factor - focus conservation efforts on areas with suitable thermal conditions',
      );
    }

    if (elevationSuitability < 50) {
      recommendations.push(
        isCitizen
          ? 'This species has specific elevation preferences - check local topography'
          : 'Elevation requirements suggest targeting specific altitudinal zones for habitat management',
      );
    }

    if (latitudeRange > 40) {
      recommendations.push(
        isCitizen
          ? 'This species is quite adaptable and can grow in various regions'
          : 'Wide latitudinal distribution suggests high adaptive capacity and climate resilience',
      );
    } else {
      recommendations.push(
        isCitizen
          ? 'This species has specific regional preferences - research local growing conditions'
          : 'Narrow distribution suggests vulnerability to climate change and habitat loss',
      );
    }

    if (countries.length > 10) {
      recommendations.push(
        isCitizen
          ? 'This is a cosmopolitan species found in many countries'
          : 'Wide geographic distribution indicates potential for assisted migration programs',
      );
    }

    return {
      suitability,
      confidence,
      factors: {
        temperature: temperatureSuitability,
        precipitation: precipitationSuitability,
        elevation: elevationSuitability,
        humanActivity: humanActivitySuitability,
      },
      recommendations,
    };
  }, [occurrences, isCitizen]);

  useEffect(() => {
    if (occurrences.length > 0) {
      setLoading(true);
      // Simulate API call delay
      setTimeout(() => {
        setPrediction(generatePrediction());
        setLoading(false);
      }, 1000);
    } else {
      setPrediction(null);
    }
  }, [occurrences, generatePrediction]);

  if (loading) {
    return (
      <div
        className={`p-6 rounded-lg border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-700'}`}
      >
        <div className="flex items-center space-x-3 mb-4">
          <Brain
            className={`w-6 h-6 ${isCitizen ? 'text-green-600' : 'text-blue-600'} animate-pulse`}
          />
          <h3 className={`text-lg font-semibold ${textColors.primary}`}>
            Analyzing Distribution Patterns...
          </h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div
            className={`h-4 ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'} rounded w-3/4`}
          ></div>
          <div
            className={`h-4 ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'} rounded w-1/2`}
          ></div>
          <div
            className={`h-4 ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'} rounded w-5/6`}
          ></div>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div
        className={`p-6 rounded-lg border ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'}`}
      >
        <div className="text-center">
          <Brain className={`w-12 h-12 ${textColors.secondary} mx-auto mb-3`} />
          <p className={`${textColors.secondary}`}>
            No distribution data available for prediction analysis
          </p>
        </div>
      </div>
    );
  }

  const getSuitabilityColor = (value: number) => {
    if (value >= 70) {return isCitizen ? 'text-green-600' : 'text-green-600';}
    if (value >= 40) {return 'text-yellow-600';}
    return 'text-red-600';
  };

  const getSuitabilityBg = (value: number) => {
    if (value >= 70) {return isCitizen ? 'bg-green-100' : 'bg-green-100';}
    if (value >= 40) {return 'bg-yellow-100';}
    return 'bg-red-100';
  };

  return (
    <div
      className={`p-6 rounded-lg border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-700'}`}
    >
      <div className="flex items-center space-x-3 mb-6">
        <Brain className={`w-6 h-6 ${isCitizen ? 'text-green-600' : 'text-blue-600'}`} />
        <h3 className={`text-lg font-semibold ${textColors.primary}`}>
          Species Distribution Analysis
        </h3>
      </div>

      {/* Overall Suitability */}
      <div
        className={`p-4 rounded-lg mb-6 ${getSuitabilityBg(prediction.suitability)} border border-opacity-30`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-800">Habitat Suitability</span>
          <span className={`font-bold text-lg ${getSuitabilityColor(prediction.suitability)}`}>
            {Math.round(prediction.suitability)}%
          </span>
        </div>
        <div
          className={`w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'} rounded-full h-3`}
        >
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              prediction.suitability >= 70
                ? 'bg-green-500'
                : prediction.suitability >= 40
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${prediction.suitability}%` }}
          />
        </div>
        <p className={`text-sm mt-2 ${textColors.secondary}`}>
          Confidence: {Math.round(prediction.confidence)}% ({occurrences.length} occurrence
          {occurrences.length !== 1 ? 's' : ''})
        </p>
      </div>

      {/* Environmental Factors */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className={`p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'}`}>
          <div className="flex items-center space-x-2 mb-2">
            <Thermometer className="w-4 h-4 text-red-500" />
            <span className={`text-sm font-medium ${textColors.primary}`}>Temperature</span>
          </div>
          <div
            className={`text-lg font-bold ${getSuitabilityColor(prediction.factors.temperature)}`}
          >
            {Math.round(prediction.factors.temperature)}%
          </div>
        </div>

        <div className={`p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'}`}>
          <div className="flex items-center space-x-2 mb-2">
            <CloudRain className="w-4 h-4 text-blue-500" />
            <span className={`text-sm font-medium ${textColors.primary}`}>Precipitation</span>
          </div>
          <div
            className={`text-lg font-bold ${getSuitabilityColor(prediction.factors.precipitation)}`}
          >
            {Math.round(prediction.factors.precipitation)}%
          </div>
        </div>

        <div className={`p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'}`}>
          <div className="flex items-center space-x-2 mb-2">
            <Mountains className="w-4 h-4 text-purple-500" />
            <span className={`text-sm font-medium ${textColors.primary}`}>Elevation</span>
          </div>
          <div className={`text-lg font-bold ${getSuitabilityColor(prediction.factors.elevation)}`}>
            {Math.round(prediction.factors.elevation)}%
          </div>
        </div>

        <div className={`p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'}`}>
          <div className="flex items-center space-x-2 mb-2">
            <MapPin className="w-4 h-4 text-orange-500" />
            <span className={`text-sm font-medium ${textColors.primary}`}>Human Activity</span>
          </div>
          <div
            className={`text-lg font-bold ${getSuitabilityColor(prediction.factors.humanActivity)}`}
          >
            {Math.round(prediction.factors.humanActivity)}%
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <h4 className={`font-semibold ${textColors.primary} mb-3 flex items-center gap-2`}>
          <TrendUp className="w-5 h-5" />
          {isCitizen ? 'Growing Recommendations' : 'Conservation Insights'}
        </h4>
        <div className="space-y-2">
          {prediction.recommendations.map((rec, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${theme === 'light' ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/30 border-blue-700'} border`}
            >
              <p className={`text-sm ${textColors.primary}`}>{rec}</p>
            </div>
          ))}
        </div>
      </div>

      <div
        className={`mt-4 p-3 rounded-lg ${theme === 'light' ? 'bg-yellow-50 border-yellow-200' : 'bg-yellow-900/30 border-yellow-700'} border`}
      >
        <p className={`text-xs ${textColors.secondary}`}>
          <strong>Note:</strong> This analysis is based on current occurrence data and simplified
          environmental modeling. For {isCitizen ? 'serious cultivation' : 'conservation planning'},
          consult with local experts and conduct site-specific assessments.
        </p>
      </div>
    </div>
  );
};

export default SpeciesDistributionPrediction;
