'use client';

import React, { useState } from 'react';
import { MapPin, Check, Save, Layers, AlertCircle } from 'lucide-react';
import { Geofence } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';

export interface GeofenceConfiguratorProps {
  geofences: Geofence[];
  onSave: (id: string, updates: Partial<Geofence>) => Promise<void>;
}

export function GeofenceConfigurator({
  geofences,
  onSave,
}: GeofenceConfiguratorProps) {
  const [selectedGeofence, setSelectedGeofence] = useState<Geofence>(geofences[0]);
  const [radius, setRadius] = useState<number>(selectedGeofence?.radiusMeters || 150);
  const [maxAccuracy, setMaxAccuracy] = useState<number>(
    selectedGeofence?.maxAllowedAccuracyMeters || 35
  );
  const [latitude, setLatitude] = useState<number>(
    selectedGeofence?.center?.latitude || 28.613939
  );
  const [longitude, setLongitude] = useState<number>(
    selectedGeofence?.center?.longitude || 77.209021
  );
  const [isActive, setIsActive] = useState<boolean>(selectedGeofence?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSelect = (geo: Geofence) => {
    setSelectedGeofence(geo);
    setRadius(geo.radiusMeters || 150);
    setMaxAccuracy(geo.maxAllowedAccuracyMeters || 35);
    setLatitude(geo.center?.latitude || 28.613939);
    setLongitude(geo.center?.longitude || 77.209021);
    setIsActive(geo.isActive);
    setSaveSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onSave(selectedGeofence.id, {
        radiusMeters: Number(radius),
        maxAllowedAccuracyMeters: Number(maxAccuracy),
        center: {
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
        isActive,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Geofence List */}
      <Card padding="md" className="space-y-3 lg:col-span-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Designated Campus Zones
        </h3>

        <div className="space-y-2">
          {geofences.map((geo) => {
            const isCurrent = geo.id === selectedGeofence.id;
            return (
              <button
                key={geo.id}
                type="button"
                onClick={() => handleSelect(geo)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-700'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                    {geo.name}
                  </span>
                  <Badge variant={geo.isActive ? 'emerald' : 'slate'}>
                    {geo.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1">{geo.description}</p>
                <div className="mt-2 text-[10px] font-mono text-slate-400">
                  Radius: {geo.radiusMeters}m • Max Tol: ±{geo.maxAllowedAccuracyMeters}m
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Editor & Map View */}
      <Card padding="lg" className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {selectedGeofence.name}
            </h2>
            <p className="text-xs text-slate-500">Code: {selectedGeofence.code}</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Zone Enabled
            </span>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
          </label>
        </div>

        {/* Spatial Radar Schematic */}
        <div className="w-full h-44 bg-slate-950 rounded-2xl relative overflow-hidden flex items-center justify-center border border-slate-800">
          {/* Radar Circles */}
          <div className="w-36 h-36 rounded-full border border-indigo-500/30 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full border border-indigo-500/50 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
          </div>

          <div className="absolute bottom-3 left-4 text-[11px] text-slate-400 font-mono">
            Center: [{latitude.toFixed(6)}, {longitude.toFixed(6)}]
          </div>
          <div className="absolute bottom-3 right-4 text-[11px] text-indigo-400 font-mono font-semibold">
            Perimeter: {radius}m Radius
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Center Latitude"
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(parseFloat(e.target.value))}
              required
            />
            <Input
              label="Center Longitude"
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(parseFloat(e.target.value))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Radius (Meters)"
              type="number"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value, 10))}
              helperText="Allowed circular radius from center point (typically 100-250m)"
              required
            />
            <Input
              label="Max GPS Accuracy Tolerance (Meters)"
              type="number"
              value={maxAccuracy}
              onChange={(e) => setMaxAccuracy(parseInt(e.target.value, 10))}
              helperText="Client readings weaker than this accuracy will be rejected (e.g. 35m)"
              required
            />
          </div>

          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 border border-emerald-200">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Geofence parameters updated and synchronized with spatial engine.</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSaving}
              icon={<Save className="w-4 h-4" />}
            >
              Save Geofence Parameters
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
