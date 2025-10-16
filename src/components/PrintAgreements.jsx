import React, { useEffect, useState } from 'react';

const PrintAgreements = ({ ndr, onClose }) => {
  const [members, setMembers] = useState({ males: [], females: [], directors: [] });

  useEffect(() => {
    // This would fetch and organize members
    // For now, using ndr data
    setMembers({
      males: ndr.males || [],
      females: ndr.females || [],
      directors: ndr.directors || []
    });
  }, [ndr]);

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto print:relative">
      <div className="max-w-4xl mx-auto p-8">
        {/* Hide buttons when printing */}
        <div className="mb-4 print:hidden flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Close
          </button>
        </div>

        {/* Male Agreement Page */}
        <div className="page-break mb-8 border-2 border-black p-6">
          <h2 className="text-xl font-bold text-center mb-4">Event Participant Agreement (Males)</h2>
          
          <div className="mb-6 text-sm">
            <p className="mb-2">By signing this form, I verify that:</p>
            <ol className="list-decimal ml-6 space-y-1">
              <li>I have not consumed any alcoholic beverages or illegal drugs today.</li>
              <li>I am 18 or older and have a valid driver's license.</li>
              <li>I am currently covered under a valid automobile liability insurance policy.</li>
            </ol>
          </div>

          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 text-left">Member Name</th>
                <th className="border border-black p-2 text-left">Signature</th>
                <th className="border border-black p-2 text-left">Cell Phone</th>
                <th className="border border-black p-2 text-left">Local Phone</th>
              </tr>
            </thead>
            <tbody>
              {members.males.map((member, index) => (
                <tr key={index}>
                  <td className="border border-black p-3">{member.name}</td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3">{member.phone}</td>
                  <td className="border border-black p-3">{member.phone}</td>
                </tr>
              ))}
              {/* Add empty rows if needed */}
              {Array.from({ length: Math.max(0, 10 - members.males.length) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-black p-3 h-12"></td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Female Agreement Page */}
        <div className="page-break mb-8 border-2 border-black p-6">
          <h2 className="text-xl font-bold text-center mb-4">Event Participant Agreement (Females)</h2>
          
          <div className="mb-6 text-sm">
            <p className="mb-2">By signing this form, I verify that:</p>
            <ol className="list-decimal ml-6 space-y-1">
              <li>I have not consumed any alcoholic beverages or illegal drugs today.</li>
              <li>I am 18 or older and have a valid driver's license.</li>
              <li>I am currently covered under a valid automobile liability insurance policy.</li>
            </ol>
          </div>

          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 text-left">Member Name</th>
                <th className="border border-black p-2 text-left">Signature</th>
                <th className="border border-black p-2 text-left">Cell Phone</th>
                <th className="border border-black p-2 text-left">Local Phone</th>
              </tr>
            </thead>
            <tbody>
              {members.females.map((member, index) => (
                <tr key={index}>
                  <td className="border border-black p-3">{member.name}</td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3">{member.phone}</td>
                  <td className="border border-black p-3">{member.phone}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 10 - members.females.length) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-black p-3 h-12"></td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3"></td>
                  <td className="border border-black p-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Driver Agreement Pages - One per car */}
        {[1, 2, 3, 4, 5].map(carNum => (
          <div key={carNum} className="page-break mb-8 border-2 border-black p-6">
            <h2 className="text-lg font-bold text-center mb-4">Herschel Driver Agreement and Assumption of Risk</h2>
            <h3 className="text-center mb-4">Car {carNum}</h3>
            
            <div className="text-xs leading-relaxed mb-6">
              <p className="mb-3">
                By signing this document, the Driver, ____________________, agrees to drive a group CARPOOL members around BCS. 
                The Driver assumes the responsibility for himself/herself and of all members in the car. By signing this agreement, 
                the Driver acknowledges that CARPOOL purchases medical insurance to cover all conference attendees inside the transport 
                vehicle in the occurrence of an accident or in any other appropriate incident. However, the Driver also acknowledges 
                that CARPOOL does not purchase any insurance covering damage to the Driver's car or to third parties (persons or property) 
                involved in the accident. The responsibility is left with the Driver and their personal insurance to cover any costs 
                associated with vehicular and/or third party damage incurred.
              </p>
              
              <p className="mb-3">
                All Passengers, as listed below, acknowledge that by signing this agreement, CARPOOL does purchase insurance to cover 
                members in the Driver's vehicle to the extent provided by these policies. In the event that an accident does occur, 
                the Passenger's personal medical insurance will only be used as secondary coverage if CARPOOL's policy does not completely 
                cover costs from injuries resulting directly because of the accident. All Passengers also acknowledge that there are external 
                risks associated with riding in the Driver's vehicle which are out of CARPOOL's control and that each Passenger has voluntarily 
                chosen to assume these risks by riding in the Driver's vehicle.
              </p>
              
              <p>
                This is an agreement between CARPOOL, the Driver of the car transporting the members, and the Passengers in the transport vehicle.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6 border-t border-black pt-4">
              <div>
                <p className="text-xs mb-2">Director in Charge (Print)</p>
                <div className="border-b border-black h-8"></div>
              </div>
              <div>
                <p className="text-xs mb-2">Signature</p>
                <div className="border-b border-black h-8"></div>
              </div>
              <div>
                <p className="text-xs mb-2">Date</p>
                <div className="border-b border-black h-8"></div>
              </div>
            </div>

            <div className="mb-6 border-t border-black pt-4">
              <p className="text-sm font-semibold mb-3">Driver</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs mb-2">DRIVER (Print)</p>
                  <div className="border-b border-black h-8"></div>
                </div>
                <div>
                  <p className="text-xs mb-2">Signature</p>
                  <div className="border-b border-black h-8"></div>
                </div>
              </div>
            </div>

            <div className="border-t border-black pt-4">
              <p className="text-sm font-semibold mb-3">Passengers</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(passengerNum => (
                  <React.Fragment key={passengerNum}>
                    <div>
                      <p className="text-xs mb-1">Name (Print)</p>
                      <div className="border-b border-black h-6"></div>
                    </div>
                    <div>
                      <p className="text-xs mb-1">Signature</p>
                      <div className="border-b border-black h-6"></div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        @media print {
          .page-break {
            page-break-after: always;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintAgreements;