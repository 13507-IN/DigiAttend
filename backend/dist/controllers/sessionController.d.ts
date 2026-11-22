import { Request, Response } from 'express';
export declare const sessionController: {
    startSession(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    stopSession(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getActiveSessions(req: Request, res: Response): Promise<void>;
    getSessionAttendance(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
};
//# sourceMappingURL=sessionController.d.ts.map