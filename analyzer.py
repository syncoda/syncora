import librosa
import numpy as np
import os 
import csv
import matplotlib.pyplot as plt
import librosa.display

folder_path = "songs"
output_csv = "audio_features_improved.csv"
plots_folder = "plots"

os.makedirs(plots_folder, exist_ok=True)

frame_length = 2048
hop_length = 512

#Normalization
def normalize(x, min_val, max_val):
    if max_val - min_val == 0:
        return 0
    return max(0,min(1,(x - min_val) / (max_val - min_val)))

#mood map
def map_to_mood(valence, arousal):
    if arousal > 0.7 and valence > 0.6:
        return "Energetic / Happy"
    elif arousal > 0.7 and valence < 0.4:
        return "Tense / Aggressive"
    elif arousal < 0.4 and valence < 0.4:
        return "Sad / Calm"
    elif arousal < 0.4 and valence > 0.6:
        return "Peaceful / Positive"
    else:
        return "Neutral / Mixed"

def process_file(file_path):
    try:
        y, sr = librosa.load(file_path, sr=None)

        #Features
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)
        avg_rms = np.mean(rms)

        energy_frames = np.array([
            np.sum(y[i:i+frame_length]**2)
            for i in range(0, len(y), hop_length)
        ])
        avg_energy = np.mean(energy_frames)

        dbfs = 20 * np.log10(np.maximum(np.abs(y), 1e-6))
        avg_dbfs = np.mean(dbfs)

        centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)
        avg_centroid = np.mean(centroid)

        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, n_fft=frame_length, hop_length=hop_length)
        mfcc_mean = np.mean(mfccs, axis=1)

        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        if isinstance(tempo, np.ndarray):
            tempo = np.mean(tempo)

        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)

        major = sum(chroma_mean[i] for i in range(12) if i in [0, 2, 4, 5, 7, 9, 11])
        minor = sum(chroma_mean[i] for i in range(12) if i in [0, 2, 3, 5, 7, 8, 10])
        mode  = "Major" if major > minor else "Minor"
        dynamic_level = np.std(rms)
        intensity = np.mean(librosa.onset.onset_strength(y=y, sr=sr))

        #Normalized Features
        norm_tempo = normalize(tempo, 40, 200)
        norm_centroid = normalize(avg_centroid, 500, 4000)
        norm_rms = normalize(avg_rms, 0, 0.3)
        norm_intensity = normalize(intensity, 0, 5)
        norm_dynamic = normalize(dynamic_level, 0, 0.1)

        #VAE
        #overall power
        energy = (
            0.5 * norm_rms +
            0.3 * norm_dynamic +
            0.2 * norm_intensity
        )
        
        #arousal 
        #calm or intense
        arousal = (
            0.3 * norm_rms +
            0.2 * norm_dynamic +
            0.2 * norm_intensity +
            0.3 * norm_tempo
        )

        mode_val = 1 if mode == "Major" else 0
        #valence
        valence = (
            0.4 * mode_val +
            0.2 * norm_centroid +
            0.2 * norm_tempo + 
            0.2 * (1 - norm_dynamic)
        )

        #clamp
        energy = min(max(energy, 0), 1)
        arousal = min(max(arousal, 0), 1)
        valence = min(max(valence, 0), 1)

        #mood label
        mood = map_to_mood(valence,arousal)
        confidence = round((energy + arousal + valence) / 3, 2)

        #CSV
        row = [
            os.path.basename(file_path),
            mood,
            confidence,
            valence,
            arousal,
            energy,
            tempo,
            avg_rms,
            avg_dbfs,
            avg_centroid,
            dynamic_level,
            intensity
        ]

        row.extend(mfcc_mean)

        #plot
        plt.figure(figsize=(14, 10))

        plt.subplot(4, 1, 1)
        librosa.display.waveshow(y, sr=sr)
        plt.title("Waveform")

        plt.subplot(4, 1, 2)
        rms_vals = rms[0]
        times = librosa.frames_to_time(range(len(rms_vals)), sr=sr, hop_length=hop_length)
        plt.plot(times, rms_vals)
        plt.title("RMS Energy")

        plt.subplot(4, 1, 3)
        D = librosa.amplitude_to_db(np.abs(librosa.stft(y)), ref=np.max)
        librosa.display.specshow(D, sr=sr, x_axis='time', y_axis='log')
        plt.title("Spectrogram")
        plt.colorbar(format="%+2.0f dB")

        plt.subplot(4, 1, 4)
        librosa.display.waveshow(y, sr=sr)
        beat_times = librosa.frames_to_time(beats, sr=sr)
        plt.vlines(beat_times, ymin=min(y), ymax=max(y))
        plt.title("Beats")

        plt.tight_layout()

        plot_filename = os.path.join(
            plots_folder,
            os.path.basename(file_path).replace(".mp3", ".png").replace(".wav", ".png")
        )

        plt.savefig(plot_filename)
        plt.close()

        return row


    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None
    
#csv header
header = [
    "filename",
    "mood",
    "confidence",
    "valence",
    "arousal",
    "energy",
    "tempo",
    "avg_rms",
    "avg_dbfs",
    "avg_centroid",
    "dynamic_level",
    "intensity"
]+[f"mfcc_{i+1}" for i in range(13)]

#run
with open(output_csv, mode="w", newline="") as file:
    writer = csv.writer(file)
    writer.writerow(header)

    for filename in os.listdir(folder_path):
        if filename.endswith(".mp3") or filename.endswith(".wav"):
            full_path = os.path.join(folder_path, filename)
            print(f"Processing: {filename}")

            row = process_file(full_path)
            if row:
                writer.writerow(row)

print("CSV dataset created:", output_csv)
