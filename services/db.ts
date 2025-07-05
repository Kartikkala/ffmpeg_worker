import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

export async function enqueueFirst() {
    const job = await prisma.$transaction(async (tx) => {
        const jobs = await tx.$queryRawUnsafe<{
            id: number;
            userId: string;
            sourceFileKey: string;
            outputFormat: string;
            status: string;
            outputFileKey: string | null;
            startedAt: Date | null;
            completedAt: Date | null;
            errorMessage: string | null;
            createdAt: Date;
        }[]>(`
      SELECT * FROM "VideoJob"
      WHERE status = 'PENDING'
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);

        if (jobs.length === 0) return null;

        await tx.videoJob.update({
            where: { id: jobs[0].id },
            data: {
                status: 'PROCESSING',
                startedAt: new Date(),
            },
        });

        return jobs[0];
    });

    return job;
}

export async function createVideoJob(data: {
    userId: string;
    sourceFileKey: string;
    outputFormat: string;
}): Promise<number> {
    const job = await prisma.videoJob.create({
        data,
        select: { id: true },
    });
    return job.id;
}

export async function updateJobStatus(id: number, status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED') {
    await prisma.videoJob.update({
        where: { id },
        data: {
            status,
            ...(status === 'PROCESSING' && { startedAt: new Date() }),
            ...(status === 'COMPLETED' && { completedAt: new Date() }),
        },
    });
}

export async function updateJobOutput(id: number, outputKey: string) {
    await prisma.videoJob.update({
        where: { id },
        data: {
            outputFileKey: outputKey,
            completedAt: new Date(),
            status: 'COMPLETED',
        },
    });
}

export async function updateJobError(id: number, error: string) {
    await prisma.videoJob.update({
        where: { id },
        data: {
            errorMessage: error,
            status: 'FAILED',
        },
    });
}

export async function deleteJob(id: number): Promise<void> {
    await prisma.videoJob.delete({
        where: { id },
    });
}

export async function getJobById(id: number) {
    return prisma.videoJob.findUnique({ where: { id } });
}

export async function listJobsByStatus(userId: string, status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' = 'PENDING') {
    return await prisma.videoJob.findMany({
        where: {
            userId,
            status,
        },
        orderBy: { createdAt: 'desc' },
    });
}

