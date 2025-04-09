// Define the SpeechRecognitionResultEvent structure
export interface SpeechRecognitionResultEvent extends Event {
  results: {
    0: {
      0: {
        transcript: string;
        confidence: number;
      }
    };
    length: number;
  };
}

// Create a custom event for speech recognition results
export function createSpeechRecognitionResultEvent(transcript: string, confidence: number = 0.9): SpeechRecognitionResultEvent {
  // Create the event
  const event = new Event('speechrecognitionresult') as SpeechRecognitionResultEvent;
  
  // Add the results structure
  Object.defineProperty(event, 'results', {
    value: {
      0: {
        0: {
          transcript,
          confidence
        }
      },
      length: 1
    },
    writable: false
  });
  
  return event;
}

// Helper to dispatch the event
export function dispatchSpeechResult(transcript: string, confidence: number = 0.9): void {
  const event = createSpeechRecognitionResultEvent(transcript, confidence);
  window.dispatchEvent(event);
} 