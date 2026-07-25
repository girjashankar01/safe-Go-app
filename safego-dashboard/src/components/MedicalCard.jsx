import React from 'react';
import { Heart, ActivitySquare, AlertCircle, Pill } from 'lucide-react';

export default function MedicalCard({ identity }) {
  if (!identity || (!identity.personal?.bloodGroup && !identity.medical?.allergies && !identity.medical?.medicalConditions && !identity.medical?.medications)) {
    return (
      <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30 text-center text-sm text-gray-500">
        No medical information available
      </div>
    );
  }

  const { personal, medical } = identity;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-sm">
      <div className="bg-gray-800/50 p-4 border-b border-gray-700/50">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 uppercase tracking-wide">
          <Heart className="w-4 h-4 text-rose-500" /> Medical Profile
        </h3>
      </div>
      
      <div className="p-4 space-y-4">
        {personal?.bloodGroup && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Blood Group</div>
            <div className="font-medium text-rose-400 text-lg">{personal.bloodGroup}</div>
          </div>
        )}

        {medical?.medicalConditions && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <ActivitySquare className="w-3.5 h-3.5" /> Conditions
            </div>
            <div className="text-gray-200 text-sm leading-relaxed">{medical.medicalConditions}</div>
          </div>
        )}

        {medical?.allergies && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Allergies
            </div>
            <div className="text-gray-200 text-sm leading-relaxed">{medical.allergies}</div>
          </div>
        )}

        {medical?.medications && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5" /> Medications
            </div>
            <div className="text-gray-200 text-sm leading-relaxed">{medical.medications}</div>
          </div>
        )}
      </div>
    </div>
  );
}
