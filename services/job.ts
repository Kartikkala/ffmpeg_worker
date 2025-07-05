import { VideoJob } from "../generated/prisma";
import FfmpegHelper from "./ffmpeg";
import minio from 'minio';
import fs from 'fs';
import path from 'path';
import { updateJobError, updateJobStatus, updateJobOutput } from "./db";

export async function processJob(job: VideoJob, ffmpeg: FfmpegHelper, minioClient: minio.Client, bucket : string, workingDir : string) {
    const fileName = job.sourceFileKey.split("/").pop()!;
    const ext = path.extname(fileName);           // ".mp4"
    const base = path.basename(fileName, ext);    // "video"
    const outputFileName = `${base}_streamable${ext}`;
    const tempInputPath = path.join(workingDir, fileName);
    const tempOutputPath = path.join(workingDir, outputFileName);

    try {
        // 1. Download from S3
        const inputStream = await minioClient.getObject(bucket, job.sourceFileKey);
        const inputFile = fs.createWriteStream(tempInputPath);

        inputStream.pipe(inputFile);

        await new Promise((resolve, reject) => {
            inputStream.on("error", reject);
            inputFile.on("error", reject);
            inputFile.on("finish", ()=>{
                resolve(0)
            });
        });

        // 2. Convert using ffmpeg
        await ffmpeg.makeStreamable(tempInputPath); // assume it outputs to another file

        // 3. Upload converted video
        const outputKey = job.sourceFileKey.replace(fileName, outputFileName);
        await minioClient.fPutObject(bucket, outputKey, tempOutputPath, {
            "Content-Type": "video/mp4",
        });

        // 4. Update DB
        await updateJobOutput(job.id, outputKey);

    } catch (e: any) {
        await updateJobStatus(job.id, "FAILED");
        await updateJobError(job.id, e.message || "Unknown error");
    } finally {
        // 5. Cleanup
        try { fs.unlinkSync(tempInputPath); } catch {}
        try { fs.unlinkSync(tempOutputPath); } catch {}
    }
}
