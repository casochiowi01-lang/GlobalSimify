import { Global, Module } from '@nestjs/common';
import { TaskDispatcher } from './task-dispatcher.service.js';
@Global()
@Module({ providers: [TaskDispatcher], exports: [TaskDispatcher] })
export class TasksModule {}
